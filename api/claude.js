export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    // 메모, 노트, OCR 등 모든 형태의 입력을 유연하게 받습니다.
    const prompt = body.prompt || body.text || body.content || "";
    const system = body.system || "";
    const image = body.image;

    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += prompt || "요청 내용이 없습니다.";

    const parts = [{ text: finalPrompt }];

    // 사진(OCR) 완벽 대응 (camelCase 문법)
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

    // 🎯 팩트 체크 완료: 존재하지 않는 2.5를 지우고 최신 2.0으로 고정합니다!
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    // 🎯 구글 API가 에러를 뿜었을 때 500으로 뻗지 않고 정확한 이유를 알려주도록 방어막 추가
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
    // 에러 발생 시 프론트엔드로 구체적인 원인을 전달
    res.status(500).json({ error: error.message || "서버 동작 중 알 수 없는 에러가 발생했습니다." });
  }
}
