export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, image, text, system } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY가 설정되지 않았습니다." });
    }

    let finalPrompt = "";
    if (system) finalPrompt += `[System]\n${system}\n\n`;
    finalPrompt += prompt || text || "사업자등록증 정보를 JSON으로 추출해줘.";

    const parts = [{ text: finalPrompt }];

    if (image && image.base64) {
      const cleanBase64 = image.base64.includes(",")
        ? image.base64.split(",")[1]
        : image.base64;

      parts.push({
        inline_data: {
          mime_type: image.mimeType || "image/jpeg",
          data: cleanBase64,
        },
      });
    }

    const body = {
      contents: [{ parts }],
      generationConfig: {
        responseFormat: {
          text: {
            mimeType: "application/json",
          },
        },
      },
    };

    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ];

    let lastError = null;

    for (const model of models) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!data.error) {
        const resultText =
          data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        return res.status(200).json({
          text: resultText,
          model,
        });
      }

      lastError = data.error;
      console.error(`Gemini API Error from ${model}:`, data.error);
    }

    return res.status(503).json({
      error:
        lastError?.message ||
        "Gemini 모델이 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.",
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
