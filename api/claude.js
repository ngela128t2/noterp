export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image } = req.body;

    // 1. 이미지 데이터 전처리 (접두어 제거 로직 추가)
    // "data:image/png;base64,..." 형태에서 실제 데이터만 추출해야 합니다.
    const cleanBase64 = image.base64.includes(",") 
      ? image.base64.split(",")[1] 
      : image.base64;

    const parts = [
      { text: prompt }, // 텍스트를 먼저 넣는 것이 안정적일 때가 많습니다.
      {
        inline_data: {
          mime_type: image.mimeType || "image/jpeg",
          data: cleanBase64
        }
      }
    ];

    const response = await fetch(
     `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts }],
          // JSON 형태로만 답하도록 강제하는 설정 (선택 사항)
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      }
    );

    const data = await response.json();

    // API 에러 발생 시 로그 확인용
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      return res.status(400).json({ error: data.error.message });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text }); // 프론트엔드에서 받기 편하게 구조 단순화

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message });
  }
}
