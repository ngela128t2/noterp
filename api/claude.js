export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image, text, system } = req.body;
    
    // 🎯 제 실수(특수기호 오류)를 완벽하게 고친 프롬프트 부분입니다.
    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += `[User]\n${prompt || text || "사업자등록증 정보를 JSON으로 추출해."}\n반드시 순수한 JSON 형식으로만 응답하고, 마크다운 기호나 다른 설명은 절대 덧붙이지 마.`;

    const parts = [{ text: finalPrompt }];

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

    const API_KEY = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ parts }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error Detail:", data);
      return res.status(400).json({ error: data.error?.message || "잘못된 요청입니다." });
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    resultText = resultText.replace(/```json|```/g, "").trim(); // 혹시 모를 찌꺼기 제거
    
    res.status(200).json({ text: resultText });

  } catch (error) {
    console.error("서버 내부 에러:", error);
    res.status(500).json({ error: "서버 동작 중 에러가 발생했습니다." });
  }
}
