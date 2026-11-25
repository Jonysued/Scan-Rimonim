import SwiftUI

struct LoginView: View {
    @EnvironmentObject var auth: AuthStore
    enum Modo { case ingresar, registrar, confirmar, recuperar, restablecer }
    @State private var modo: Modo = .ingresar
    @State private var email = ""
    @State private var password = ""
    @State private var nombre = ""
    @State private var codigo = ""
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
                        .disabled(modo == .confirmar || modo == .restablecer)
                    if modo == .confirmar || modo == .restablecer {
                        TextField("Código de 6 dígitos del email", text: $codigo)
                            .keyboardType(.numberPad).textContentType(.oneTimeCode)
                    }
                    if modo == .ingresar || modo == .registrar || modo == .restablecer {
                        SecureField(modo == .restablecer ? "Contraseña nueva" : "Contraseña", text: $password)
                            .textContentType(modo == .ingresar ? .password : .newPassword)
                    }
                } footer: {
                    if modo == .confirmar { Text("Te mandamos un email con un código. Escribilo acá para activar tu cuenta.") }
                    if modo == .restablecer { Text("Te mandamos un email con un código. Escribilo junto con tu contraseña nueva.") }
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
                    .disabled(trabajando || !valido)
                }
                if let e = auth.error { Section { Text(e).foregroundStyle(.red) } }
                if let a = aviso { Section { Text(a).foregroundStyle(.green) } }
                Section {
                    if modo != .ingresar { Button("Ya tengo cuenta") { cambiar(.ingresar) } }
                    if modo == .ingresar { Button("Crear cuenta") { cambiar(.registrar) } }
                    if modo == .ingresar { Button("Olvidé mi contraseña") { cambiar(.recuperar) } }
                    if modo == .restablecer || modo == .confirmar {
                        Button("Reenviar código") { Task { await reenviar() } }
                    }
                }
            }
        }
    }

    var valido: Bool {
        switch modo {
        case .ingresar: return !email.isEmpty && !password.isEmpty
        case .registrar: return !email.isEmpty && password.count >= 6
        case .recuperar: return !email.isEmpty
        case .confirmar: return codigo.count >= 6
        case .restablecer: return codigo.count >= 6 && password.count >= 6
        }
    }

    var titulo: String {
        switch modo {
        case .ingresar: return "Ingresar"
        case .registrar: return "Crear cuenta"
        case .confirmar: return "Activar cuenta"
        case .recuperar: return "Enviarme un código"
        case .restablecer: return "Guardar contraseña nueva"
        }
    }

    func cambiar(_ m: Modo) {
        modo = m; aviso = nil; auth.error = nil; codigo = ""
        if m != .ingresar { password = "" }
    }

    func reenviar() async {
        if modo == .restablecer, await auth.recuperar(email: email) { aviso = "Te reenviamos el código." }
        if modo == .confirmar { aviso = "Si no llegó, revisá spam o pedí a un administrador que te active." }
    }

    func enviar() async {
        trabajando = true; aviso = nil
        defer { trabajando = false }
        switch modo {
        case .ingresar:
            await auth.ingresar(email: email, password: password)
        case .registrar:
            if await auth.registrar(email: email, password: password, nombre: nombre) {
                // Si el proyecto no exige confirmar email, entra directo
                await auth.ingresar(email: email, password: password)
                if auth.userId == nil { auth.error = nil; cambiar(.confirmar) }
            }
        case .confirmar:
            if await auth.confirmarAlta(email: email, codigo: codigo) { aviso = "Cuenta activada." }
        case .recuperar:
            if await auth.recuperar(email: email) { cambiar(.restablecer) }
        case .restablecer:
            if await auth.restablecer(email: email, codigo: codigo, nueva: password) { aviso = "Contraseña actualizada." }
        }
    }
}
