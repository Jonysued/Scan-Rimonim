import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthStore
    enum Modo { case ingresar, registrar, recuperar }
    @State private var modo: Modo = .ingresar
    @State private var email = ""
    @State private var password = ""
    @State private var nombre = ""
    @State private var trabajando = false
    @State private var aviso: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Scan Rimonim").font(.largeTitle.bold()).foregroundStyle(Tema.granate)
                        Text("Calibre y color con LiDAR").foregroundStyle(.secondary)
                    }.listRowBackground(Color.clear)
                }
                Section {
                    if modo == .registrar {
                        TextField("Nombre y apellido", text: $nombre).textContentType(.name)
                    }
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    if modo != .recuperar {
                        SecureField("Contraseña", text: $password)
                            .textContentType(modo == .registrar ? .newPassword : .password)
                    }
                }
                Section {
                    Button {
                        Task { await enviar() }
                    } label: {
                        HStack {
                            Spacer()
                            if trabajando { ProgressView() }
                            Text(titulo).bold()
                            Spacer()
                        }
                    }
                    .disabled(trabajando || email.isEmpty || (modo != .recuperar && password.count < 6))
                }
                if let e = auth.error { Section { Text(e).foregroundStyle(.red) } }
                if let a = aviso { Section { Text(a).foregroundStyle(.green) } }
                Section {
                    if modo != .ingresar { Button("Ya tengo cuenta") { modo = .ingresar } }
                    if modo != .registrar { Button("Crear cuenta") { modo = .registrar } }
                    if modo != .recuperar { Button("Olvidé mi contraseña") { modo = .recuperar } }
                }
            }
        }
    }

    var titulo: String {
        switch modo {
        case .ingresar: return "Ingresar"
        case .registrar: return "Crear cuenta"
        case .recuperar: return "Enviar email de recuperación"
        }
    }

    func enviar() async {
        trabajando = true; aviso = nil
        defer { trabajando = false }
        switch modo {
        case .ingresar:
            await auth.ingresar(email: email, password: password)
        case .registrar:
            if await auth.registrar(email: email, password: password, nombre: nombre) {
                aviso = "Cuenta creada. Revisá tu email si pide confirmación y esperá que un administrador te habilite."
                modo = .ingresar
            }
        case .recuperar:
            if await auth.recuperar(email: email) { aviso = "Te enviamos un email para cambiar la contraseña." }
        }
    }
}
