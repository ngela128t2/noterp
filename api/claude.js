
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image } = req.body;

    // 1. 데이터 구성
    const parts = [{ text: prompt || "사업자등록증 정보를 JSON으로 추출해줘." }];

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

    // 2. API 설정 (v1beta 대신 v1 사용, 모델명 확정)
    const MODEL = "gemini-1.5-flash";
    const API_KEY = process.env.GEMINI_API_KEY; // 🎯 Vercel 변수명 확인 필수!

    // 🎯 주소 끝에 :generateContent 확인
    const url = `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ parts }],
        generationConfig: {
          response_mime_type: "application/json" // 🎯 결과물을 JSON으로 강제
        }
      })
    });

    const data = await response.json();

    // 3. 에러 핸들링 보강
    if (!response.ok) {
      console.error("Gemini API 상세 에러:", data);
      return res.status(response.status).json({ 
        error: data.error?.message || "Gemini API 호출 중 에러가 발생했습니다." 
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });

  } catch (error) {
    console.error("서버 내부 에러:", error);
    res.status(500).json({ error: "서버가 응답하지 않습니다. 네트워크 설정을 확인하세요." });
  }
}
