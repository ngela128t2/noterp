export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image, text, system } = req.body;

    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += prompt || text || "사업자등록증 정보를 JSON으로 추출해줘. 마크다운 기호(```json) 없이 순수한 JSON만 반환해.";

    const parts = [{ text: finalPrompt }];

    // 🎯 사진 데이터: 구글 공식 규격(대문자 D, T) 완벽 적용
    if (image && image.base64) {
      const cleanBase64 = image.base64.includes(",") 
        ? image.base64.split(",")[1] 
        : image.base64;

      parts.push({
        inlineData: {
          mimeType: image.mimeType || "image/jpeg",
          data: cleanBase64
        }
      });
    }

    // 🎯 핵심 원인: 아까 성공했던 'gemini-2.5-flash'로 다시 고정!! (제가 1.5로 바꿨던 게 원흉입니다)
    const url = `[https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$){process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ parts }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(400).json({ error: data.error.message });
    }

    // 혹시 모를 마크다운 찌꺼기 완벽 제거
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    resultText = resultText.replace(/```json|```/g, "").trim();

    res.status(200).json({ text: resultText });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
