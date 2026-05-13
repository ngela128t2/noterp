export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image, text, system } = req.body;

    // 프롬프트 세팅
    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += prompt || text || "사업자등록증 정보를 JSON으로 추출해줘.";

    const parts = [{ text: finalPrompt }];

    // 🎯 사진 데이터 구글 공식 규격(camelCase)으로 완벽 수정!
    if (image && image.base64) {
      const cleanBase64 = image.base64.includes(",") 
        ? image.base64.split(",")[1] 
        : image.base64;

      parts.push({
        inlineData: {  // <-- 대문자 D 주의!
          mimeType: image.mimeType || "image/jpeg", // <-- 대문자 T 주의!
          data: cleanBase64
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts }],
          // 🎯 JSON 형식 강제 지시어 추가 (camelCase)
          generationConfig: {
            responseMimeType: "application/json" 
          }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(400).json({ error: data.error.message });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    res.status(200).json({ text: resultText });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
