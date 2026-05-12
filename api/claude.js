export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image, text } = req.body;
    
    // 텍스트 프롬프트 구성
    const finalPrompt = prompt || text || "사업자등록증 정보를 JSON으로 추출해줘.";
    const parts = [{ text: finalPrompt }];

    // 이미지 데이터 구성
    if (image && image.base64) {
      const cleanBase64 = image.base64.includes(",") 
        ? image.base64.split(",")[1] 
        : image.base64;

      parts.push({
        inlineData: {  // 🎯 수정됨: inline_data -> inlineData
          mimeType: image.mimeType || "image/jpeg", // 🎯 수정됨: mime_type -> mimeType
          data: cleanBase64
        }
      });
    }

    const MODEL = "gemini-1.5-flash";
    const API_KEY = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json" // 🎯 수정됨: response_mime_type -> responseMimeType
          }
        })
      }
    );

    const data = await response.json();

    // 에러 발생 시 상세 이유 반환 (400 에러 추적용)
    if (!response.ok) {
      console.error("Gemini API Error Detail:", data);
      return res.status(400).json({ error: data.error?.message || "잘못된 요청(400)입니다." });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    res.status(200).json({ text: resultText });

  } catch (error) {
    console.error("서버 내부 에러:", error);
    res.status(500).json({ error: "서버 동작 중 에러가 발생했습니다." });
  }
}
