export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
  sameLanguage: boolean;
}

const clientCache = new Map<string, TranslationResult>();

export async function translateText(
  text: string,
  targetLanguage: string
): Promise<TranslationResult> {
  const key = `${targetLanguage}::${text.trim()}`;
  const cached = clientCache.get(key);
  if (cached) return cached;

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json') || !response.ok) {
      return {
        translatedText: text,
        detectedLanguage: 'Original',
        sameLanguage: true,
      };
    }

    const data = await response.json();
    const result: TranslationResult = {
      translatedText: String(data.translatedText || text),
      detectedLanguage: String(data.detectedLanguage || 'Unknown'),
      sameLanguage: Boolean(data.sameLanguage),
    };
    clientCache.set(key, result);
    return result;
  } catch {
    return {
      translatedText: text,
      detectedLanguage: 'Original',
      sameLanguage: true,
    };
  }
}
