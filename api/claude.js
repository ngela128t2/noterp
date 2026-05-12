export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image, text, system } = req.body;

    // 프롬프트 세팅
    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += prompt || text || "사업자등록증 정보를 JSON으로 추출해줘.";

    const parts = [{ text: finalPrompt }];

    // 🎯 데일리 메모(글자)만 보낼 때 서버가 터지지 않도록 방어막만 쳤습니다.
    if (image && image.base64) {
      const cleanBase64 = image.base64.includes(",") 
        ? image.base64.split(",")[1] 
        : image.base64;

      // 파트너님의 원본 문법(snake_case) 그대로 복구!
      parts.push({
        inline_data: {
          mime_type: image.mimeType || "image/jpeg",
          data: cleanBase64
        }
      });
    }

    // 🎯 파트너님이 맞았습니다. 2.5 버전으로 원상 복구!
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts }],
          // 파트너님의 원본 문법 그대로 복구!
          generationConfig: {
            response_mime_type: "application/json"
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
