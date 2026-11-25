import Foundation
import Supabase

@MainActor
final class AuthStore: ObservableObject {
    @Published var userId: UUID?
    @Published var profile: Profile?
    @Published var cargando = true
    @Published var error: String?

    var rol: Rol { profile?.role ?? .pending }
    var esAdmin: Bool { rol == .admin }
    var nombre: String { profile?.full_name ?? profile?.email ?? "" }

    func iniciar() async {
        defer { cargando = false }
        if let s = try? await supabase.auth.session {
            userId = s.user.id
            await cargarPerfil()
        }
    }

    func cargarPerfil() async {
        guard let uid = userId else { return }
        do {
            profile = try await supabase.from("profiles").select("id,email,full_name,role")
                .eq("id", value: uid).single().execute().value
        } catch {
            self.error = "No se pudo leer el perfil: \(error.localizedDescription)"
        }
    }

    func ingresar(email: String, password: String) async {
        error = nil
        do {
            let s = try await supabase.auth.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            userId = s.user.id
            await cargarPerfil()
        } catch {
            self.error = "Email o contraseña incorrectos."
        }
    }

    func registrar(email: String, password: String, nombre: String) async -> Bool {
        error = nil
        do {
            _ = try await supabase.auth.signUp(email: email.trimmingCharacters(in: .whitespaces),
                                               password: password,
                                               data: ["full_name": .string(nombre)])
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func recuperar(email: String) async -> Bool {
        do {
            try await supabase.auth.resetPasswordForEmail(email.trimmingCharacters(in: .whitespaces))
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func salir() async {
        try? await supabase.auth.signOut()
        userId = nil
        profile = nil
    }
}
