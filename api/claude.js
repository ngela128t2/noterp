export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const prompt = body.prompt || body.text || body.content || "";
    const system = body.system || "";
    const image = body.image;

    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += prompt || "요청 내용이 없습니다.";

    const parts = [{ text: finalPrompt }];

    // 사진(OCR) 완벽 대응 (대소문자 camelCase 문법 준수)
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

    // 🎯 파트너님 말씀대로 현재 활성화된 최신 무료 모델인 2.5-flash로 고정합니다.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    // 구글 API 거절 시 방어막
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", errorText);
      return res.status(400).json({ error: `구글 거절 사유: ${errorText}` });
    }

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 메모/OCR의 JSON 응답과 노트의 일반 텍스트 응답을 스마트하게 분리
    if (resultText.includes("```json")) {
      resultText = resultText.replace(/```json|```/g, "").trim();
    } else if (resultText.includes("```")) {
      resultText = resultText.replace(/```/g, "").trim();
    }

    res.status(200).json({ text: resultText });

  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error.message || "서버 동작 중 알 수 없는 에러가 발생했습니다." });
  }
}
