import Foundation
import Supabase

enum Config {
    static let supabaseURL = URL(string: "https://xsbfalrsgjtqcgdxynnw.supabase.co")!
    // Clave pública (publishable): segura para incluir en la app; los permisos los controla RLS.
    static let supabaseKey = "sb_publishable_jhNZAdjCVwr0V33j7hpWVg_XHyml4ra"
    static let photosBucket = "photos"

    // Protocolo de captura (igual al de la app actual)
    static let targetDistanceM: Float = 0.20
    static let toleranceM: Float = 0.03
    static let requiredHoldS: Double = 0.8
    static let maxStabilitySpanM: Float = 0.02
}

let supabase = SupabaseClient(supabaseURL: Config.supabaseURL, supabaseKey: Config.supabaseKey)
