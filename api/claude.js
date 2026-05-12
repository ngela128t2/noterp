export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, image, text, system } = req.body;
    
    // 프롬프트 구성 (JSON만 대답하도록 강력하게 지시)
    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += `[User]\n${prompt || text || "사업자등록증 정보를 JSON으로 추출해."}\n반드시 JSON 형식으로만 응답하고 다른 설명은 절대 덧붙이지 마.`;

    const parts = [{ text: finalPrompt }];

    // 이미지 데이터 처리
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
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ parts }]
        // 🎯 400 에러의 원인이었던 generationConfig 덩어리를 완전 삭제했습니다!
      })
    });

    const data = await response.json();

    // 에러 발생 시 처리
    if (!response.ok) {
      console.error("Gemini API Error Detail:", data);
      return res.status(400).json({ error: data.error?.message || "잘못된 요청입니다." });
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    res.status(200).json({ text: resultText });

  } catch (error) {
    console.error("서버 내부 에러:", error);
    res.status(500).json({ error: "서버 동작 중 에러가 발생했습니다." });
  }
}
