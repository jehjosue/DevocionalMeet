import { supabase } from "../lib/supabase";
import { Verse, verses as localVerses } from "../data/verses";

/**
 * Função interna para selecionar 10 versículos determinísticos baseados na data.
 */
function pickDailyVerses(pool: Verse[]): Verse[] {
    if (pool.length === 0) return [];
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const seed = dateStr.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const selected: Verse[] = [];
    const total = pool.length;

    for (let i = 0; i < Math.min(10, total); i++) {
        let idx = (seed + i * 17) % total;
        while (selected.some((v) => v.text === pool[idx].text)) {
            idx = (idx + 1) % total;
        }
        selected.push(pool[idx]);
    }
    return selected;
}

/**
 * Serviço responsável por buscar os versículos do Supabase.
 * Caso falhe, retorna os versículos locais como fallback.
 */
export const supabaseService = {
    async getDailyVerses(): Promise<Verse[]> {
        try {
            const { data, error } = await supabase
                .from("verses")
                .select("text, reference");

            if (error || !data || data.length === 0) {
                console.warn("Supabase fetch failed or empty, using mock data.");
                return pickDailyVerses(localVerses);
            }

            const mapped: Verse[] = data.map((row) => ({
                text: row.text,
                ref: row.reference,
            }));

            return pickDailyVerses(mapped);
        } catch (err) {
            console.error("Error connecting to Supabase:", err);
            return pickDailyVerses(localVerses);
        }
    }
};
