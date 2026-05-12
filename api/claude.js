export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image, text } = req.body; // text 필드도 받을 수 있게 추가

    // 🎯 1. 보낼 내용(parts) 구성
    const parts = [];
    
    // 프론트에서 prompt나 text 중 하나로 글자를 보낼 테니 둘 다 체크
    const finalPrompt = prompt || text || "";
    parts.push({ text: finalPrompt });

    // 🎯 2. 이미지(사진)가 있을 때만 처리 (이게 핵심!)
    if (image && image.base64) {
      const cleanBase64 = image.base64.includes(",") 
        ? image.base64.split(",")[1] 
        : image.base64;

      parts.push({
        inline_data: {
          mime_type: image.mimeType || "image/jpeg",
          data: cleanBase64
        }
      });
    }

    // 🎯 3. 모델명을 1.5-flash로 수정 (2.5는 에러 남)
    const MODEL = "gemini-1.5-flash";
    const API_KEY = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts }],
          generationConfig: {
            // 결과가 JSON이어야 프론트엔드 로직이 안 깨집니다
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

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text: resultText });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: "데이터 처리 중 서버 오류 발생" });
  }
}
