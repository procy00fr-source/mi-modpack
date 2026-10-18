// ==========================================================
// HUD del BOXEO v5 (KubeJS, solo en el cliente)   kubejs/startup_scripts/boxeo_hud.js
//
//  Lee los marcadores invisibles del server: bxhud1 / bxhud2 (cada ring) y bxest (estilos de cada jugador).
//   - ARRIBA: cara, nombre y ESTILO de cada boxeador, VIDA (roja), ESTAMINA (blanca), caidas y RONDA.
//   - A LA DERECHA: "\u00A1CONTRAGOLPE!", "GOLPES x1 x2..." y debajo, en gris y chiquito, los CONTROLES.
//   - Mientras pelea NO se ve la barra de abajo (vida, comida, inventario): solo los botones 1 2 3 de
//     las habilidades (como en Roblox), la ULTI y F.
//   - CAMARA FIJADA en el rival. Los golpes ya no se pueden spamear (cada estilo tiene su ritmo).
//     ESPACIO = ESQUIVAR (con A / D = a ese lado). Esquiva justo a tiempo = \u00A1ESQUIVA PERFECTA! (2 s de
//     camara lenta: blanco y negro, reloj tic-tac y la musica baja).
//   - F MANTENIDA = cubrirse.  R = ULTI (cinematica de cada estilo).  1 2 3 = habilidades (MITICO+).
//     RELAMPAGO: barra de TIMING.  ESCOPETA: 1 = DOBLE GATILLO (barra recta: 1/2 y 2/2) y su ULTI es el
//     minijuego de flechas (W A S D) con el ESCOPETA pegandole de fondo.
//   - K.O.: la camara enfoca al que cayo mientras intenta levantarse ("DOWN!" y la cuenta grande).
//   - Tecla Y = MENU DE ESTILOS (ya no abre el chat): ruleta a pantalla completa, GIRO y GIRO DE LA SUERTE,
//     aura epica (MITICO morada, LEGENDARIO amarilla como el ki, LIMITADO roja y negra).
//   - Tecla B = RUEDA DE GESTOS.   Espectador: boton "SALIR DE ESPECTADOR" (con T) o SHIFT.
//   - VICTORIA (/win): el baile lo dibuja este script. El chat queda transparente (solo las letras).
//  Las teclas se cambian en Opciones > Controles > Asignar teclas > "Din\u00E1micas".
//  Necesita el DinamicasPack v14 y el mod dinamicas_camara (la camara atraviesa las barreras).
//  Si no sale nada, mira logs/kubejs/startup.log ("HUD del boxeo v5 cargado").
// ==========================================================

function boxeoHudIniciar() {
    var $Minecraft = Java.loadClass('net.minecraft.client.Minecraft')
    var $Component = Java.loadClass('net.minecraft.network.chat.Component')
    var $RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
    var $CameraType = null
    var $Face = null
    var $RS = null
    var $ChatScreen = null
    var $InvScreen = null
    var $Double = null
    var ESTILO_BI = null
    try { $CameraType = Java.loadClass('net.minecraft.client.CameraType') } catch (e) { console.warn('boxeo_hud.js: sin CameraType: ' + e) }
    try { $Face = Java.loadClass('net.minecraft.client.gui.components.PlayerFaceRenderer') } catch (e) { console.warn('boxeo_hud.js: sin PlayerFaceRenderer: ' + e) }
    try { $RS = Java.loadClass('com.mojang.blaze3d.systems.RenderSystem') } catch (e) { console.warn('boxeo_hud.js: sin RenderSystem: ' + e) }
    try { $ChatScreen = Java.loadClass('net.minecraft.client.gui.screens.ChatScreen') } catch (e) { console.warn('boxeo_hud.js: sin ChatScreen: ' + e) }
    try { $InvScreen = Java.loadClass('net.minecraft.client.gui.screens.inventory.InventoryScreen') } catch (e) { console.warn('boxeo_hud.js: sin InventoryScreen: ' + e) }
    try { $Double = Java.loadClass('java.lang.Double') } catch (e) { }
    var $SS = null
    try { $SS = Java.loadClass('net.minecraft.sounds.SoundSource') } catch (e) { console.warn('boxeo_hud.js: sin SoundSource: ' + e) }
    try {
        var $Style = Java.loadClass('net.minecraft.network.chat.Style')
        ESTILO_BI = $Style.EMPTY.withBold(true).withItalic(true)
    } catch (e) { console.warn('boxeo_hud.js: sin letra cursiva: ' + e) }

    var ARCHIVO = 'kubejs/boxeo_hud.json'
    var BX = {
        errores: 0, d: null, est: null,
        cam: null,               // camara que tenia antes de pelear (para devolversela)
        ev: null,                // ultimos contadores de avisos del server
        cg: { desde: 0, q: 0 },  // CONTRAGOLPE
        uc: { desde: 0, q: 0 },  // ULTI conecta
        ub: { desde: 0, q: 0 },  // ULTI bloqueada / fallada
        ko: { desde: 0, q: 0 },
        gol: { desde: 0, n: 0, q: 0 },   // GOLPES xN
        tm: { desde: 0 },        // PERFECTO (timing de RELAMPAGO)
        pf: { desde: 0, fin: 0, q: 0, activo: false },   // ESQUIVA PERFECTA
        gris: false,             // efecto blanco y negro puesto
        imp: 0,                  // ultimo impacto de la ULTI (destello + sacudida)
        hpVis: [0, 100, 100],
        tex: {}, texEn: 0,
        rEn: 0,
        fHeld: false, fRaw: false,
        salto: false,            // ESPACIO apretado (para no repetir)
        rtEn: 0,
        ruleta: false,           // ruleta de estilos abierta (sobre el chat)
        rueda: false,            // rueda de gestos abierta (sobre el chat)
        gs: null, giro: null, giroPedido: 0,
        nivel: null,
        win: { id: null, desde: 0 },
        hab: null,               // DOBLE GATILLO (tecla 1 de ESCOPETA): { etapa, desde, zona, ... }
        habFin: 0,               // cuando termino el ultimo DOBLE GATILLO (para no empezar otro encima)
        golEn: 0,                // ultimo golpe permitido (ritmo del estilo)
        lento: { desde: 0 },     // camara lenta de la ULTI del NECROID
        vol: null,               // volumen de la musica antes de bajarla (esquiva perfecta)
        hola: '',                // ya le avise al server que tengo el script (en esta pelea)
        koCam: { activo: false, desde: 0 },
        cnt: { en: 0, v: -1 },   // cuenta del K.O. (para la animacion del numero)
        mg: null,                // minijuego de flechas de la ULTI de ESCOPETA
        spEn: 0, esqEn: 0, tmEnv: 0,     // para no mandar comandos de mas
        grisShader: false, grisNo: false,
        cfg: { chat: false }
    }
    var bxLog = (donde, e) => {
        if (BX.errores < 12) console.error('boxeo_hud.js (' + donde + '): ' + e)
        BX.errores++
    }
    try {
        var dj = JsonIO.read(ARCHIVO)
        if (dj != null && String(dj.get('chat')) == 'true') BX.cfg.chat = true
    } catch (e) { }
    var guardarCfg = () => {
        try {
            JsonIO.write(ARCHIVO, { chat: BX.cfg.chat })
        } catch (e) {
            bxLog('guardar', e)
        }
    }
    var col = (n) => n | 0
    var PI_ = 3.141592653589793   // (el Rhino de KubeJS no tiene Math.PI)
    var GRAD = 180 / PI_
    var fuente = () => $Minecraft.getInstance().font
    var ahora = () => Date.now()

    // ---------------------------------------------------------------- estilos (iguales que en boxeo.sk)
    //  hab: habilidades [tecla, nombre, recarga en ticks]   ritmo: ticks entre golpes normales
    var ESTILOS = [
        { nom: 'BOXEADOR', tier: 0, ulti: 'COMBO FINAL', hab: [], ritmo: 10,
          desc: 'El estilo con el que empieza todo campe\u00F3n. Jab y cruzado, gancho de derecha como golpe fuerte. ULTI: una lluvia de 5 golpes seguidos que termina en uppercut.' },
        { nom: 'REL\u00C1MPAGO', tier: 1, ulti: 'ESQUIVA FANTASMA', hab: [], ritmo: 7,
          desc: 'Tus pu\u00F1os son un borr\u00F3n: jabs rapid\u00EDsimos. Golpea cuando la barra de TIMING est\u00E9 en la zona verde y ser\u00E1 PERFECTO. Golpe fuerte: un uno-dos rapid\u00EDsimo. ULTI: esquivas su golpe y le revientas la cara.' },
        { nom: 'TIT\u00C1N', tier: 1, ulti: 'TERREMOTO', hab: [], ritmo: 15,
          desc: 'Lento como una monta\u00F1a, duro como el acero. Martillazos pesados, recibes menos da\u00F1o y tu escudo aguanta m\u00E1s. ULTI: golpe al suelo que lo levanta y martillazo final.' },
        { nom: 'SUPERNOVA', tier: 2, ulti: 'SUPERNOVA', hab: [['1', 'ESTALLIDO', 280], ['2', 'DESTELLO', 200]], ritmo: 10,
          desc: 'Una estrella a punto de explotar. 1 ESTALLIDO SOLAR: te cruzas de brazos y explotas (lo ciega y lo lanza). 2 DESTELLO: te lanzas como un rayo. ULTI: brillas, 3 golpes y explotas.' },
        { nom: 'ESCOPETA', tier: 3, ulti: 'LLUVIA DE PLOMO', hab: [['1', 'DOBLE GATILLO', 240]], ritmo: 9,
          desc: 'Cada golpe es un disparo. 1 DOBLE GATILLO: acierta la barra 2 veces (1/2 y 2/2) y sueltas 2 golpes dobles. ULTI: minijuego de flechas mientras lo acribillas; al final, DOBLE GATILLO con tu porcentaje.' },
        { nom: 'NECROID', tier: 4, ulti: 'QUIEBRAHUESOS', hab: [['1', 'ZARPA', 200], ['2', 'ALMA ROBADA', 320], ['3', 'PASO SOMBRA', 240]], ritmo: 9,
          desc: 'Una sombra que no se deja tocar: esquivas mucho m\u00E1s f\u00E1cil. 1 ZARPA, 2 ALMA ROBADA (le robas vida), 3 PASO SOMBRA (apareces detr\u00E1s). ULTI: le rompes las costillas y lo mandas a volar en c\u00E1mara lenta.' },
        { nom: 'CALLEJERO', tier: 0, ulti: 'PELEA DE BAR', hab: [], ritmo: 12,
          desc: 'Aprendiste a pelear en la calle. Volados y golpes al cuerpo, cabezazo como golpe fuerte. ULTI: patada, cabezazo y martillazo con las 2 manos.' },
        { nom: 'RANA', tier: 1, ulti: 'SALTO DE RANA', hab: [], ritmo: 11,
          desc: 'Siempre agachado, como una rana lista para saltar. Uppercuts saltando. ULTI: lo haces mirar a otro lado, apareces debajo de \u00E9l y lo mandas a volar con los 2 pu\u00F1os.' },
        { nom: 'FANTASMA', tier: 2, ulti: 'POSESI\u00D3N', hab: [['1', 'ESPECTRO', 300], ['2', 'SUSTO', 260]], ritmo: 10,
          desc: 'Flotas como un fantasma. Rev\u00E9s girando como golpe fuerte. 1 ESPECTRO: los golpes te atraviesan 3 s. 2 SUSTO: \u00A1BUU! lo paralizas. ULTI: te metes en su cuerpo y se pega solo.' },
        { nom: 'EMPERADOR', tier: 3, ulti: 'DECRETO REAL', hab: [['1', 'PU\u00D1O IMPERIAL', 260], ['2', 'ARMADURA', 400]], ritmo: 10,
          desc: 'Peleas con una mano en la espalda. 1 PU\u00D1O IMPERIAL: la mano de atr\u00E1s sale con todo y rompe guardias. 2 ARMADURA DORADA: 4 s recibiendo la mitad. ULTI: lo obligas a arrodillarse y lo aplastas.' }
    ]
    var TIERS = [
        { nom: 'B\u00C1SICO', pct: 60, su: 0, c: 0xFF43D160, o: 0xFF1D6B30, lista: 'Boxeador \u00B7 Callejero' },
        { nom: 'RARO', pct: 27, su: 0, c: 0xFF3B8CFF, o: 0xFF183F8C, lista: 'Rel\u00E1mpago \u00B7 Tit\u00E1n \u00B7 Rana' },
        { nom: 'M\u00CDTICO', pct: 8, su: 65, c: 0xFFC65CFF, o: 0xFF5E1C86, lista: 'Supernova \u00B7 Fantasma', aura: 'm' },
        { nom: 'LEGENDARIO', pct: 4, su: 28, c: 0xFFF0D04A, o: 0xFF7A6512, lista: 'Escopeta \u00B7 Emperador', aura: 'l' },
        { nom: 'LIMITADO', pct: 1, su: 7, c: 0xFFFF2E3E, o: 0xFF2A0508, limitado: true, lista: 'Necroid', aura: 'x' }
    ]
    var estilo = (k) => ESTILOS[k] || ESTILOS[0]
    // color de una categoria (LIMITADO: rojo sangre que late con negro)
    var colorTier = (k) => {
        var tr = TIERS[k] || TIERS[0]
        if (!tr.limitado) return tr.c
        var f = (Math.sin(ahora() / 180) + 1) / 2
        var r = Math.round(150 + 105 * f), gg = Math.round(10 + 40 * f), b = Math.round(20 + 40 * f)
        return col(0xFF000000 | (r << 16) | (gg << 8) | b)
    }
    // duracion maxima de la cinematica de cada ULTI (ticks, por estilo 0..9); PF = esquiva perfecta
    var PF = 10
    var ULTI_DUR = [56, 50, 50, 54, 330, 70, 56, 62, 56, 60, 40]

    var WIN_G = ["kazotsky", "roblox", "saludo", "aplauso", "senalar"]
    var WIN_N = [23, 43, 50, 23, 83]
    var WIN_SEQ = [[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,17,16,15,14,13,12,11,10,11,12,13,14,15,16,17,18,17,16,15,14,13,12,11,10,11,12,13,14,15,16,17,18,17,16,15,14,13,12,11,10,19,20,12,21,22,14,15,16,17,18,17,16,15,14,13,12,11,10,11,12,13,14,15,16,17,18,17,16,15,14,13,12,11,10,11,12,13,14,15,16,17],[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,34,33,32,36,37,38,39,40,41,42,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,34,33,32,36,37,38,39,40,41,42,0,1,2,3,4,5,6,7],[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49],[0,1,2,3,4,5,6,7,8,9,10,11,12,11,10,11,12,11,10,11,12,11,10,11,12,11,10,11,12,11,10,11,12,11,10,13,14,15,16,17,5,18,19,20,21,22,0,1,2,3,4,5,6,7,8,9,10,11,12,11,10,11,12,11,10,11,12,11,10,11,12,11,10,11,12,11,10,11,12,11,10,13,14,15,16,17,5,18,19,20,21,22,0,1,2,3,4,5,6,7],[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]]

    // ---- teclas: se pueden cambiar en Opciones > Controles > Asignar teclas > "Din\u00E1micas" ----
    var TECLA = { ulti: null, cubrir: null, estilos: null, gestos: null }
    try {
        var $KeyMapping = Java.loadClass('net.minecraft.client.KeyMapping')
        TECLA.ulti = new $KeyMapping('key.dinamicas.ulti', 82, 'key.categories.dinamicas')
        TECLA.cubrir = new $KeyMapping('key.dinamicas.cubrirse', 70, 'key.categories.dinamicas')
        TECLA.estilos = new $KeyMapping('key.dinamicas.estilos', 89, 'key.categories.dinamicas')
        TECLA.gestos = new $KeyMapping('key.dinamicas.gestos', 66, 'key.categories.dinamicas')
        ForgeModEvents.onEvent('net.minecraftforge.client.event.RegisterKeyMappingsEvent', event => {
            try {
                event.register(TECLA.ulti)
                event.register(TECLA.cubrir)
                event.register(TECLA.estilos)
                event.register(TECLA.gestos)
                console.info('boxeo_hud.js: teclas del boxeo registradas')
            } catch (e) {
                console.error('boxeo_hud.js: no se pudieron registrar las teclas: ' + e)
                TECLA.cubrir = null
            }
        })
    } catch (e) {
        console.warn('boxeo_hud.js: sin teclas configurables (se usan R, F, Y y B): ' + e)
    }
    var codigoTecla = (m, def) => {
        if (m == null) return def
        try {
            var k = m.getKey()
            if (String(k.getType()) != 'KEYSYM') return -1
            return Number(k.getValue())
        } catch (e) {
            return def
        }
    }
    var nombreTecla = (m, def) => {
        if (m == null) return def
        try {
            var t = String(m.getTranslatedKeyMessage().getString()).toUpperCase()
            return t.length > 0 && t.length <= 6 ? t : def
        } catch (e) {
            return def
        }
    }

    var miNombre = () => {
        var mc = $Minecraft.getInstance()
        try {
            if (mc.player != null) return String(mc.player.getUsername())
        } catch (e) { }
        try {
            return String(mc.getUser().getName())
        } catch (e) {
            bxLog('mi nombre', e)
        }
        return ''
    }
    var comando = (c) => {
        try {
            var con = $Minecraft.getInstance().getConnection()
            if (con != null) con.sendCommand(c)
        } catch (e) {
            bxLog('comando ' + c, e)
        }
    }

    // ---- datos del server ----
    var miembro = (sb, equipo) => {
        var t = sb.getPlayerTeam(equipo)
        if (t == null) return ''
        var it = t.getPlayers().iterator()
        if (it.hasNext()) return String(it.next())
        return ''
    }
    // marcador bxest: estilo, giros, ranuras de cada jugador y si hay mini boxeo
    var estLeer = () => {
        var mc = $Minecraft.getInstance()
        if (mc.level == null || mc.player == null) return null
        var sb = mc.level.getScoreboard()
        var obj = sb.getObjective('bxest')
        if (obj == null) return null
        var yo = miNombre()
        var n = (k, def) => sb.hasPlayerScore(k, obj) ? Number(sb.getOrCreatePlayerScore(k, obj).getScore()) : def
        return { lb: n('#lb', 0), es: n('#es_' + yo, 0), gs: n('#gs_' + yo, -1), gr: n('#gr_' + yo, 0),
                 s1: n('#s1_' + yo, -1), s2: n('#s2_' + yo, -1), rv: n('#rv_' + yo, 0),
                 gl: n('#gl_' + yo, 0), gk: n('#gk_' + yo, 0), rc: n('#rc_' + yo, 0) }
    }
    // marcador del ring donde peleo (o que miro)
    var bxLeer = (est) => {
        var mc = $Minecraft.getInstance()
        if (mc.level == null || mc.player == null) return null
        var sb = mc.level.getScoreboard()
        var yo = miNombre()
        var r = 0, yoI = 0
        for (var k = 1; k <= 2 && r == 0; k++) {
            if (miembro(sb, 'bxrojo' + k) == yo) { r = k; yoI = 1 }
            else if (miembro(sb, 'bxazul' + k) == yo) { r = k; yoI = 2 }
        }
        if (r == 0 && est != null && est.rv > 0) r = est.rv
        if (r == 0) return null
        var obj = sb.getObjective('bxhud' + r)
        if (obj == null) return null
        var val = (k) => sb.hasPlayerScore(k, obj) ? Number(sb.getOrCreatePlayerScore(k, obj).getScore()) : null
        if (val('#on') != 1) return null
        var n = (k, def) => {
            var v = val(k)
            return v == null ? def : v
        }
        var d = { r: r, p: [null, {}, {}] }
        for (var i = 1; i <= 2; i++) {
            var p = d.p[i]
            p.hp = n('#hp' + i, 1000) / 10
            p.st = n('#st' + i, 100)
            p.sh = n('#sh' + i, 100)
            p.ul = n('#ul' + i, 0)
            p.ko = n('#ko' + i, 0)
            p.g = n('#g' + i, 0)
            p.cs = n('#cs' + i, 0)
            p.ck = n('#ck' + i, 0)
            p.es = n('#es' + i, 0)
            p.dg = n('#dg' + i, 0)
            p.tm = n('#tm' + i, 0)
            p.cd = [n('#cd' + i + '1', 0), n('#cd' + i + '2', 0), n('#cd' + i + '3', 0), n('#cd' + i + '4', 0)]
        }
        d.dn = n('#dn', 0)
        d.cnt = n('#cnt', -1)
        d.rd = n('#rd', 1)
        d.fa = n('#fa', 1)
        d.cg = n('#cg', 0); d.cgq = n('#cgq', 0)
        d.uc = n('#uc', 0); d.uq = n('#uq', 0); d.us = n('#us', 0); d.ui = n('#ui', 0); d.uf = n('#uf', 0)
        d.ub = n('#ub', 0); d.ubq = n('#ubq', 0)
        d.gc = n('#gc', 0); d.gn = n('#gn', 0); d.gq = n('#gq', 0)
        d.pf = n('#pf', 0); d.pfq = n('#pfq', 0); d.pfe = n('#pfe', 0)
        d.fin = n('#fin', 0)
        d.sl = n('#sl', 0)
        d.n1 = miembro(sb, 'bxrojo' + r)
        d.n2 = miembro(sb, 'bxazul' + r)
        d.yoN = yo
        d.yo = yoI
        return d
    }
    var nombreDe = (d, i) => i == 1 ? d.n1 : (i == 2 ? d.n2 : '')

    // ---- entidades: el rival (jugador por su nombre o el saco de la prueba) ----
    var entCache = {}
    var entidad = (nombre) => {
        if (nombre == null || nombre == '') return null
        var mc = $Minecraft.getInstance()
        if (mc.level == null || mc.player == null) return null
        var t = ahora()
        var c = entCache[nombre]
        if (c != null && t - c.en < 1000) {
            if (c.e == null) return null
            try {
                if (!c.e.isRemoved()) return c.e
            } catch (e) { }
        }
        var res = null
        try {
            if (nombre == 'Saco') {
                var es = mc.level.getEntities()
                var md = 1e9
                for (var i = 0; i < es.size(); i++) {
                    var en = es.get(i)
                    var cn = en.getCustomName()
                    if (cn == null) continue
                    if (String(cn.getString()).indexOf('Saco') < 0) continue
                    var dd = Number(en.distanceToEntitySqr(mc.player))
                    if (dd < md) { md = dd; res = en }
                }
            } else {
                var ps = mc.level.getPlayers()
                for (var j = 0; j < ps.size(); j++) {
                    var p = ps.get(j)
                    if (String(p.getUsername()) == nombre) { res = p; break }
                }
            }
        } catch (e) {
            bxLog('entidad', e)
        }
        entCache[nombre] = { e: res, en: t }
        return res
    }
    var pos = (e, pt) => {
        var x = Number(e.getX()), y = Number(e.getY()), z = Number(e.getZ())
        try {
            var xo = Number(e.xo), yo = Number(e.yo), zo = Number(e.zo)
            if (!isNaN(xo) && !isNaN(yo) && !isNaN(zo)) {
                x = xo + (x - xo) * pt
                y = yo + (y - yo) * pt
                z = zo + (z - zo) * pt
            }
        } catch (e2) { }
        return { x: x, y: y, z: z }
    }
    var angulos = (a, b) => {
        var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        var h = Math.sqrt(dx * dx + dz * dz)
        return { yaw: Math.atan2(-dx, dz) * GRAD, pitch: -Math.atan2(dy, h) * GRAD, h: h }
    }
    var difAng = (a, b) => ((((b - a) % 360) + 540) % 360) - 180

    // avisos: cuando un contador del server sube, se muestra el aviso
    var bxAvisos = (d) => {
        var t = ahora()
        var claves = ['cg', 'uc', 'ub', 'dn', 'gc', 'ui', 'uf', 'pf', 'pfe', 'r', 'sl']
        var foto = {}
        for (var k = 0; k < claves.length; k++) foto[claves[k]] = d[claves[k]]
        foto.tm = d.yo > 0 ? d.p[d.yo].tm : 0
        if (BX.ev == null || BX.ev.r != d.r) {
            BX.ev = foto
            return
        }
        if (d.cg != BX.ev.cg) { BX.cg.desde = t; BX.cg.q = d.cgq }
        if (d.uc != BX.ev.uc) { BX.uc.desde = t; BX.uc.q = d.uq; cineEmpezar(d, d.us, d.uq) }
        if (d.ub != BX.ev.ub) { BX.ub.desde = t; BX.ub.q = d.ubq }
        if (d.dn != BX.ev.dn && d.dn > 0) { BX.ko.desde = t; BX.ko.q = d.dn }
        if (d.gc != BX.ev.gc && d.gn > 0) { BX.gol = { desde: t, n: d.gn, q: d.gq } }
        if (d.ui != BX.ev.ui) BX.imp = t
        if (d.uf != BX.ev.uf) cineTerminar()
        if (foto.tm != BX.ev.tm) BX.tm.desde = t
        if (d.pf != BX.ev.pf) {
            BX.pf = { desde: t, fin: 0, q: d.pfq, activo: true }
            cineEmpezar(d, PF, d.pfq)
        }
        if (d.sl != BX.ev.sl) BX.lento.desde = t
        if (d.cnt != BX.cnt.v) { BX.cnt.v = d.cnt; BX.cnt.en = t }
        if (d.pfe != BX.ev.pfe) BX.pf.fin = t
        BX.ev = foto
    }
    // ---- texturas del paquete ----
    var rl = (s) => new $RL(s)
    var existe = (s) => {
        var t = ahora()
        if (t - BX.texEn > 10000) {
            BX.tex = {}
            BX.texEn = t
        }
        if (BX.tex[s] != null) return BX.tex[s]
        var ok = false
        try {
            ok = $Minecraft.getInstance().getResourceManager().getResource(rl(s)).isPresent()
        } catch (e) {
            bxLog('textura ' + s, e)
        }
        BX.tex[s] = ok
        return ok
    }
    var blend = (si) => {
        if ($RS == null) return
        try {
            if (si) {
                $RS.enableBlend()
                $RS.defaultBlendFunc()
            } else {
                $RS.disableBlend()
            }
        } catch (e) {
            bxLog('blend', e)
        }
    }
    // dibuja la textura entera (tw x th) en x, y con tamano w x h y transparencia a
    var imagen = (g, s, x, y, w, h, tw, th, a) => {
        if (!existe(s)) return false
        if (a < 1) g.setColor(1, 1, 1, Math.max(0, a))
        g.blit(rl(s), Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, tw, th, tw, th)
        if (a < 1) g.setColor(1, 1, 1, 1)
        return true
    }
    // solo la parte de abajo (fraccion f) de la textura: para el escudo que se va gastando
    var imagenAbajo = (g, s, x, y, w, h, tw, th, f) => {
        if (!existe(s)) return false
        var vh = Math.round(th * f)
        if (vh <= 0) return true
        var hh = Math.round(h * f)
        g.blit(rl(s), Math.round(x), Math.round(y + h - hh), Math.round(w), hh, 0, th - vh, tw, vh, tw, th)
        return true
    }

    // ---- texto (drawWordWrap: el unico metodo de texto que KubeJS no confunde) ----
    var ancho = (t) => {
        try {
            return Number(fuente().width(String(t)))
        } catch (e) {
            return 6 * String(t).length
        }
    }
    // color con transparencia (Minecraft dibuja opaco si la transparencia es casi 0)
    var conAlfa = (c, a) => {
        var al = Math.round(255 * Math.max(0.03, Math.min(1, a)))
        return col(((al & 255) << 24) | (c & 0xFFFFFF))
    }
    var texto = (g, t, x, y, c, sombra) => {
        var comp = $Component.literal(String(t))
        if (sombra) g.drawWordWrap(fuente(), comp, Math.floor(x) + 1, Math.floor(y) + 1, 900, col(0xFF101010 & (c | 0x00FFFFFF)))
        g.drawWordWrap(fuente(), comp, Math.floor(x), Math.floor(y), 900, col(c))
    }
    // texto en NEGRITA CURSIVA (los carteles de la ULTI)
    var textoBI = (g, t, x, y, c, sombra) => {
        var comp = $Component.literal(String(t))
        try {
            if (ESTILO_BI != null) comp = comp.setStyle(ESTILO_BI)
        } catch (e) { }
        if (sombra) g.drawWordWrap(fuente(), comp, Math.floor(x) + 1, Math.floor(y) + 1, 900, col(0xFF101010 & (c | 0x00FFFFFF)))
        g.drawWordWrap(fuente(), comp, Math.floor(x), Math.floor(y), 900, col(c))
    }
    var textoC = (g, t, cx, y, c) => texto(g, t, cx - ancho(t) / 2, y, c, true)
    // texto grande (escala s) centrado en cx
    var textoG = (g, t, cx, y, s, c) => {
        var p = g.pose()
        p.pushPose()
        p.scale(s, s, 1)
        texto(g, t, (cx - (ancho(t) * s) / 2) / s, y / s, c, true)
        p.popPose()
    }
    // texto grande (escala s) desde x
    var textoGI = (g, t, x, y, s, c, bi) => {
        var p = g.pose()
        p.pushPose()
        p.scale(s, s, 1)
        if (bi) textoBI(g, t, x / s, y / s, c, true)
        else texto(g, t, x / s, y / s, c, true)
        p.popPose()
    }
    // texto en varias lineas (ancho w); devuelve el alto usado
    var parrafo = (g, t, x, y, w, c) => {
        var palabras = String(t).split(' ')
        var linea = '', yy = y
        for (var i = 0; i < palabras.length; i++) {
            var prueba = linea == '' ? palabras[i] : linea + ' ' + palabras[i]
            if (ancho(prueba) > w && linea != '') {
                texto(g, linea, x, yy, c, true)
                yy += 10
                linea = palabras[i]
            } else {
                linea = prueba
            }
        }
        if (linea != '') { texto(g, linea, x, yy, c, true); yy += 10 }
        return yy - y
    }
    var caja = (g, x, y, w, h, c) => {
        if (w <= 0 || h <= 0) return
        g.fill(Math.floor(x), Math.floor(y), Math.floor(x + w), Math.floor(y + h), col(c))
    }
    var marco = (g, x, y, w, h, c) => {
        caja(g, x - 1, y - 1, w + 2, 1, c)
        caja(g, x - 1, y + h, w + 2, 1, c)
        caja(g, x - 1, y, 1, h, c)
        caja(g, x + w, y, 1, h, c)
    }
    var dentro = (x, y, x1, y1, w, h) => x >= x1 && x < x1 + w && y >= y1 && y < y1 + h

    // ---- cara del jugador (skin del paquete; sin skin = Steve) ----
    var cara = (g, nombre, x, y, s, borde) => {
        caja(g, x - 2, y - 2, s + 4, s + 4, 0xFF000000)
        caja(g, x - 1, y - 1, s + 2, s + 2, borde)
        var nm = String(nombre).toLowerCase()
        var tex = 'dinamicas:textures/item/cabezas/' + nm + '.png'
        if (!existe(tex)) tex = 'dinamicas:textures/item/cabezas/steve.png'
        if ($Face != null && existe(tex)) {
            try {
                $Face.draw(g, rl(tex), Math.round(x), Math.round(y), Math.round(s))
                return
            } catch (e) {
                bxLog('cara', e)
            }
        }
        caja(g, x, y, s, s, 0xFF3A3A3A)
        textoC(g, String(nombre).charAt(0).toUpperCase(), x + s / 2, y + s / 2 - 4, 0xFFFFFFFF)
    }

    // ---- escudo dorado pequeno (fraccion f) ----
    var escudoMini = (g, x, y, w, h, f, roto) => {
        if (roto) {
            if (!imagen(g, 'dinamicas:textures/gui/boxeo/escudo_vacio.png', x, y, w, h, 40, 40, 0.8)) caja(g, x, y, w, h, 0x80404040)
            textoC(g, 'X', x + w / 2, y + h / 2 - 4, 0xFFFF4444)
            return
        }
        var ok = imagen(g, 'dinamicas:textures/gui/boxeo/escudo_vacio.png', x, y, w, h, 40, 40, 1)
        if (ok) {
            imagenAbajo(g, 'dinamicas:textures/gui/boxeo/escudo.png', x, y, w, h, 40, 40, f)
        } else {
            caja(g, x, y, w, h, 0x80303030)
            var hh = Math.round(h * f)
            caja(g, x, y + h - hh, w, hh, 0xE0F0B020)
        }
    }

    // ---- barra de arriba de un boxeador (lado -1 = izquierda / rojo, +1 = derecha / azul) ----
    var barraJugador = (g, d, i, cx, half, y0) => {
        var p = d.p[i]
        var lado = i == 1 ? -1 : 1
        var nombre = i == 1 ? (d.n1 == '' ? 'ROJO' : d.n1) : (d.n2 == '' ? 'AZUL' : d.n2)
        var cTeam = i == 1 ? 0xFFE03030 : 0xFF3070E0
        var fs = 20
        var xCara = lado < 0 ? cx - half : cx + half - fs
        var x0 = lado < 0 ? xCara + fs + 5 : cx + 12        // barra: desde x0 ...
        var x1 = lado < 0 ? cx - 12 : xCara - 5             // ... hasta x1
        var bw = x1 - x0
        // cara, nombre y estilo
        cara(g, nombre, xCara, y0 + 3, fs, cTeam)
        var es = estilo(p.es)
        var etq = es.nom
        if (lado < 0) {
            texto(g, nombre, x0, y0, 0xFFFFFFFF, true)
            texto(g, etq, x0 + ancho(nombre) + 6, y0, colorTier(es.tier), true)
        } else {
            texto(g, nombre, x1 - ancho(nombre), y0, 0xFFFFFFFF, true)
            texto(g, etq, x1 - ancho(nombre) - 6 - ancho(etq), y0, colorTier(es.tier), true)
        }
        // vida (se vacia desde afuera hacia el centro, como en el video)
        var hp = Math.max(0, Math.min(100, p.hp))
        if (BX.hpVis[i] < hp) BX.hpVis[i] = hp
        BX.hpVis[i] = Math.max(hp, BX.hpVis[i] - 0.6)
        var yb = y0 + 10, bh = 8
        caja(g, x0 - 1, yb - 1, bw + 2, bh + 2, 0xFF000000)
        caja(g, x0, yb, bw, bh, 0xFF2A1A1A)
        var fv = Math.round(bw * BX.hpVis[i] / 100)
        var fh = Math.round(bw * hp / 100)
        if (lado < 0) {
            caja(g, x1 - fv, yb, fv, bh, 0xFFFFE0A0)
            caja(g, x1 - fh, yb, fh, bh, 0xFFD02020)
            caja(g, x1 - fh, yb, fh, 2, 0xFFFF7070)
        } else {
            caja(g, x0, yb, fv, bh, 0xFFFFE0A0)
            caja(g, x0, yb, fh, bh, 0xFFD02020)
            caja(g, x0, yb, fh, 2, 0xFFFF7070)
        }
        // estamina: barra BLANCA debajo
        var ys = yb + bh + 3, sh = 3
        var st = Math.max(0, Math.min(100, p.st))
        var fsw = Math.round(bw * st / 100)
        var cSt = 0xFFFFFFFF
        if (p.cs == 1) cSt = (ahora() % 400) < 200 ? 0xFF909090 : 0xFFFF6040
        caja(g, x0 - 1, ys - 1, bw + 2, sh + 2, 0xFF000000)
        caja(g, x0, ys, bw, sh, 0xFF303030)
        if (lado < 0) caja(g, x1 - fsw, ys, fsw, sh, cSt)
        else caja(g, x0, ys, fsw, sh, cSt)
        // caidas: 3 cuadritos (rojo = ya lo noquearon esa vez)
        var yk = ys + sh + 3
        for (var k = 0; k < 3; k++) {
            var xk = lado < 0 ? x0 + k * 8 : x1 - 6 - k * 8
            caja(g, xk, yk, 6, 6, 0xFF000000)
            caja(g, xk + 1, yk + 1, 4, 4, k < p.ko ? 0xFFFF3030 : 0x80A0A0A0)
        }
        if (p.cs == 1) {
            var tc = '\u00A1CANSADO!'
            texto(g, tc, lado < 0 ? x0 + 28 : x1 - 28 - ancho(tc), yk - 1, 0xFFB0B0B0, true)
        }
        // escudo al lado de la cara mientras se cubre (o roto)
        if (p.g >= 1) {
            var ex = lado < 0 ? xCara + fs - 6 : xCara - 4
            escudoMini(g, ex, y0 + 14, 10, 10, Math.max(0, Math.min(100, p.sh)) / 100, p.g == 2)
        }
    }

    // ---- circulo de la ULTI (abajo al centro) ----
    var ultiCirculo = (g, cx, cy, u) => {
        var tk = nombreTecla(TECLA.ulti, 'R')
        var r = 13, n = 36
        var lleno = Math.round(n * Math.max(0, Math.min(100, u)) / 100)
        var listo = u >= 100
        var pulso = listo && (ahora() % 600) < 300
        caja(g, cx - 11, cy - 11, 22, 22, 0x90000000)
        for (var k = 0; k < n; k++) {
            var a = -PI_ / 2 + (2 * PI_ * k) / n
            var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
            var c = k < lleno ? (listo ? (pulso ? 0xFFFFFF60 : 0xFFFFC020) : 0xFFFF9020) : 0xA0404040
            caja(g, x - 1.5, y - 1.5, 3, 3, c)
        }
        if (listo) {
            textoG(g, tk, cx, cy - 7, 1.6, pulso ? 0xFFFFFF80 : 0xFFFFD040)
            textoC(g, '\u00A1ULTI! (' + tk + ')', cx, cy + 17, pulso ? 0xFFFFFF80 : 0xFFFFD040)
        } else {
            var t = Math.round(u) + '%'
            textoC(g, t, cx, cy - 4, 0xFFFFFFFF)
            textoC(g, 'ULTI', cx, cy + 17, 0xFFAAAAAA)
        }
    }

    // ---- HABILIDADES 1 2 3 (botones como en Roblox) a la izquierda de la ULTI; F a la derecha ----
    var habDe = (es, k) => {
        for (var i = 0; i < es.hab.length; i++) {
            if (es.hab[i][0] == String(k)) return es.hab[i]
        }
        return null
    }
    var habilidades = (g, cx, cy, p) => {
        var es = estilo(p.es)
        var bw = 22, gap = 5
        for (var k = 1; k <= 3; k++) {
            var h = habDe(es, k)
            var x = cx - 34 - (4 - k) * (bw + gap)
            var y = cy - bw / 2
            caja(g, x - 1, y - 1, bw + 2, bw + 2, 0xFF000000)
            if (h == null) {
                caja(g, x, y, bw, bw, 0x80202024)
                textoC(g, String(k), x + bw / 2, y + 7, 0xFF505058)
                continue
            }
            var cd = p.cd[k - 1] || 0
            var total = Math.max(1, Math.round((h[2] || 200) / 20))
            var listo = cd <= 0 && p.cs != 1
            caja(g, x, y, bw, bw, listo ? 0xE0182030 : 0xE0101014)
            if (!listo && cd > 0) {
                // se va llenando de abajo hacia arriba mientras recarga
                var f = Math.max(0, Math.min(1, cd / total))
                caja(g, x, y, bw, Math.round(bw * f), 0xC0000000)
            }
            marco(g, x, y, bw, bw, listo ? colorTier(es.tier) : 0xFF505058)
            textoC(g, String(k), x + bw / 2, y + 3, listo ? 0xFFFFFFFF : 0xFF909090)
            if (cd > 0) textoC(g, String(cd), x + bw / 2, y + 12, 0xFFFF9999)
            // nombre cortito debajo (escala pequena)
            var nm = h[1]
            var pz = g.pose()
            pz.pushPose()
            pz.scale(0.5, 0.5, 1)
            texto(g, nm, (x + bw / 2) * 2 - ancho(nm) / 2, (y + bw + 3) * 2, listo ? 0xFFDDDDDD : 0xFF886666, true)
            pz.popPose()
        }
        // F = cubrirse (a la derecha de la ULTI): se ilumina mientras la mantienes
        var xf = cx + 34 + gap
        caja(g, xf - 1, cy - bw / 2 - 1, bw + 2, bw + 2, 0xFF000000)
        caja(g, xf, cy - bw / 2, bw, bw, p.g == 1 ? 0xE0806010 : 0xC0101830)
        marco(g, xf, cy - bw / 2, bw, bw, 0xFFF0C040)
        textoC(g, nombreTecla(TECLA.cubrir, 'F'), xf + bw / 2, cy - 4, 0xFFFFE080)
        var pz2 = g.pose()
        pz2.pushPose()
        pz2.scale(0.5, 0.5, 1)
        texto(g, 'MANTENER', (xf + bw / 2) * 2 - ancho('MANTENER') / 2, (cy + bw / 2 + 3) * 2, 0xFFAAAAAA, true)
        pz2.popPose()
    }

    // ---- CONTROLES (a la derecha, debajo de los avisos; gris y chiquito) ----
    var controlesDibujar = (g, W, H) => {
        var ls = ['Clic izquierdo: golpe normal', 'Clic derecho: golpe fuerte', nombreTecla(TECLA.ulti, 'R') + ': ulti',
                  'Espacio: esquivar', nombreTecla(TECLA.cubrir, 'F') + ': cubrirse']
        var y = Math.floor(H * 0.22) + 96
        var pz = g.pose()
        pz.pushPose()
        pz.scale(0.75, 0.75, 1)
        for (var i = 0; i < ls.length; i++) {
            var tx = ls[i]
            texto(g, tx, (W - 8) / 0.75 - ancho(tx), (y + i * 8) / 0.75, 0xC0A8A8A8, true)
        }
        pz.popPose()
    }

    // ---- RELAMPAGO: barra de TIMING (golpe con el cursor en la zona verde = PERFECTO x1.8) ----
    var TIMING_P = 860       // ms ida y vuelta del cursor
    var TIMING_Z = 0.14      // media zona verde
    var timingPos = (t) => {
        var f = (t % TIMING_P) / TIMING_P
        return f < 0.5 ? f * 2 : 2 - f * 2
    }
    var timingVerde = (t) => Math.abs(timingPos(t) - 0.5) <= TIMING_Z
    var timingDibujar = (g, cx, y) => {
        var t = ahora()
        var w = 130, h = 8
        var x = cx - w / 2
        texto(g, 'TIMING', x - ancho('TIMING') - 5, y, 0xFFFFE04A, true)
        caja(g, x - 1, y - 1, w + 2, h + 2, 0xFF000000)
        caja(g, x, y, w, h, 0xFF3A1010)
        caja(g, x + w * (0.5 - TIMING_Z * 2), y, w * TIMING_Z * 4, h, 0xFF8A7010)
        caja(g, x + w * (0.5 - TIMING_Z), y, w * TIMING_Z * 2, h, 0xFF2FD050)
        var cxp = x + w * timingPos(t)
        caja(g, cxp - 1, y - 3, 3, h + 6, 0xFFFFFFFF)
        var tp = t - BX.tm.desde
        if (BX.tm.desde > 0 && tp < 700) {
            var s = 1.6 + Math.max(0, 1 - tp / 140) * 0.8
            textoG(g, '\u00A1PERFECTO!', cx, y - 18 - (tp / 700) * 6, s, conAlfa(0xFF7CFF8A, tp > 500 ? (700 - tp) / 200 : 1))
        }
    }

    // ---- ESCOPETA: DOBLE GATILLO (tecla 1): barra RECTA  -------/verde/-----  con una rayita "/" que pasa.
    //  2 timings: 1/2 y 2/2 (mas rapido y la zona mas chica). Cada acierto = un golpe doble (bxk e1).
    //  Fallar o no apretar = se acaba (bxk e0). Cada vez que se usa empieza otra vez en 1/2.
    var GAT = [null, { ms: 950, zona: 0.17 }, { ms: 720, zona: 0.12 }]
    var gatEmpezar = (etapa) => {
        BX.hab = { etapa: etapa, desde: ahora(), zona: 0.38 + Math.random() * 0.44, res: null }
    }
    var gatPos = (h, t) => (t - h.desde) / GAT[h.etapa].ms
    var gatTerminar = (ok) => {
        var t = ahora()
        BX.hab = { etapa: 0, desde: t, res: ok ? 'ok' : 'mal' }
        BX.habFin = t
    }
    // tecla 1 mientras corre la barra
    var gatPulsar = () => {
        var h = BX.hab
        if (h == null || h.etapa == 0) return false
        var x = gatPos(h, ahora())
        if (Math.abs(x - h.zona) <= GAT[h.etapa].zona / 2) {
            comando('bxk e1')
            if (h.etapa == 1) gatEmpezar(2)
            else gatTerminar(true)
        } else {
            comando('bxk e0')
            gatTerminar(false)
        }
        return true
    }
    // si la rayita llega al final sin apretar, falla
    var gatRevisar = () => {
        var h = BX.hab
        if (h == null) return
        var t = ahora()
        if (h.etapa == 0) {
            if (t - h.desde > 1100) BX.hab = null
            return
        }
        if (gatPos(h, t) > 1.05) {
            comando('bxk e0')
            gatTerminar(false)
        }
    }
    var gatDibujar = (g, cx, y) => {
        var h = BX.hab
        if (h == null) return
        var t = ahora()
        if (h.etapa == 0) {
            var ok = h.res == 'ok'
            textoG(g, ok ? '\u00A1DOBLE GATILLO 2/2!' : '\u00A1FALLASTE!', cx, y - 4, 2, ok ? 0xFFFFD040 : 0xFFFF5050)
            return
        }
        var W = $Minecraft.getInstance().getWindow().getGuiScaledWidth()
        var w = Math.min(240, Math.floor(Number(W) * 0.55)), bh = 9
        var x = cx - w / 2
        caja(g, x - 3, y - 15, w + 6, bh + 30, 0x90000000)
        texto(g, 'DOBLE GATILLO', x, y - 12, 0xFFF0D04A, true)
        var et = h.etapa + '/2'
        textoGI(g, et, x + w - ancho(et) * 1.4, y - 14, 1.4, 0xFFFFFFFF, true)
        // la barra: rayitas grises y la zona verde
        caja(g, x - 1, y - 1, w + 2, bh + 2, 0xFF000000)
        caja(g, x, y, w, bh, 0xFF262626)
        for (var q = 0; q < w; q += 6) caja(g, x + q, y + bh / 2 - 1, 4, 2, 0xFF6A6A6A)
        var zw = w * GAT[h.etapa].zona
        var zx = x + w * h.zona - zw / 2
        caja(g, zx, y, zw, bh, h.etapa == 1 ? 0xFF2FD050 : 0xFF7CFF8A)
        caja(g, zx, y, zw, 2, 0xFFB0FFB8)
        // la rayita "/" que pasa
        var px = x + w * Math.max(0, Math.min(1, gatPos(h, t)))
        for (var k = 0; k < 8; k++) caja(g, px - 3 + k, y + bh + 2 - k * 2, 2, 3, 0xFFFFFFFF)
        textoC(g, '\u00A1Pulsa 1 en lo verde!', cx, y + bh + 6, 0xFFFFE080)
    }

    // ---- ULTI de ESCOPETA: minijuego de flechas (como Friday Night Funkin'): las flechas SUBEN hasta los
    //  receptores de arriba; SICK!! / GOOD / BIEN / FALLO, Combinacion | Precision y al final el NIVEL ----
    var MG_CARRIL = [
        { k: 'A', c: 0xFFC24BFF, codes: [65, 263], fl: '\u25C0' },
        { k: 'S', c: 0xFF3FD0FF, codes: [83, 264], fl: '\u25BC' },
        { k: 'W', c: 0xFF4CFF6A, codes: [87, 265], fl: '\u25B2' },
        { k: 'D', c: 0xFFFF4A4A, codes: [68, 262], fl: '\u25B6' }
    ]
    var MG_N = 24, MG_VIAJE = 1300, MG_VENT = 150
    var mgEmpezar = () => {
        var notas = []
        var tt = 1600, ant = -1, ant2 = -1
        for (var i = 0; i < MG_N; i++) {
            var c = Math.floor(Math.random() * 4)
            if (c == ant && c == ant2) c = (c + 1 + Math.floor(Math.random() * 3)) % 4
            notas.push({ t: tt, c: c, ok: 0 })
            ant2 = ant
            ant = c
            tt += (i >= 10 && i < 16) ? 270 : 470   // en el medio: rafaga rapida
        }
        BX.mg = { desde: ahora(), notas: notas, ac: 0, fallos: 0, combo: 0, maxc: 0, pts: 0, fin: tt + 300, enviado: false, flash: [0, 0, 0, 0], txt: null }
    }
    var mgTecla = (code) => {
        var m = BX.mg
        if (m == null || m.enviado) return false
        var c = -1
        for (var k = 0; k < 4; k++) {
            if (MG_CARRIL[k].codes.indexOf(code) >= 0) c = k
        }
        if (c < 0) return false
        var t = ahora() - m.desde
        var mejor = null
        for (var i = 0; i < m.notas.length; i++) {
            var n = m.notas[i]
            if (n.ok != 0 || n.c != c) continue
            if (Math.abs(n.t - t) <= MG_VENT) { mejor = n; break }
        }
        m.flash[c] = ahora()
        if (mejor != null) {
            mejor.ok = 1
            m.ac++
            m.combo++
            m.maxc = Math.max(m.maxc, m.combo)
            var dt = Math.abs(mejor.t - t)
            if (dt < 50) { m.txt = { s: 'SICK!!', en: ahora(), c: 0xFF4CE8FF }; m.pts += 1 }
            else if (dt < 100) { m.txt = { s: 'GOOD!', en: ahora(), c: 0xFF7CFF8A }; m.pts += 0.8 }
            else { m.txt = { s: 'BIEN', en: ahora(), c: 0xFFFFE04A }; m.pts += 0.6 }
            comando('bxk uh')
        }
        return true
    }
    var mgRevisar = () => {
        var m = BX.mg
        if (m == null) return
        var t = ahora() - m.desde
        for (var i = 0; i < m.notas.length; i++) {
            var n = m.notas[i]
            if (n.ok == 0 && t > n.t + MG_VENT) {
                n.ok = -1
                m.fallos++
                m.combo = 0
                m.txt = { s: 'FALLO', en: ahora(), c: 0xFFFF5050 }
            }
        }
        if (!m.enviado && t >= m.fin) {
            m.enviado = true
            m.pc = Math.round(m.ac * 100 / MG_N)
            m.finEn = ahora()
            comando('bxk uf ' + m.pc)
        }
        if (m.enviado && t >= m.fin + 2600) BX.mg = null
    }
    var mgNivel = (pc) => pc >= 99 ? ['S', 0xFFFFD040] : (pc >= 85 ? ['A', 0xFF7CFF8A] : (pc >= 65 ? ['B', 0xFF4CE8FF] : (pc >= 45 ? ['C', 0xFFFF9A40] : ['D', 0xFFFF5050])))
    var mgDibujar = (g, W, H) => {
        var m = BX.mg
        if (m == null) return
        var ta = ahora()
        var t = ta - m.desde
        var lw = 28, x0 = Math.floor(W / 2 - lw * 2)
        var yHit = Math.max(50, Math.floor(H * 0.17)), yBot = Math.floor(H * 0.86)
        // fondo suave: se ve la pelea detras
        caja(g, x0 - 6, yHit - 6, lw * 4 + 12, yBot - yHit + 12, 0x50000000)
        for (var k = 0; k < 4; k++) {
            var C = MG_CARRIL[k]
            var xl = x0 + k * lw
            caja(g, xl + lw / 2 - 1, yHit, 2, yBot - yHit, 0x30FFFFFF)
            // receptor (arriba)
            var fl = ta - m.flash[k] < 120
            caja(g, xl + 3, yHit - 1, lw - 6, lw - 6, fl ? conAlfa(C.c, 0.95) : 0x50FFFFFF)
            marco(g, xl + 3, yHit - 1, lw - 6, lw - 6, C.c)
            textoC(g, C.fl, xl + lw / 2, yHit + 7, fl ? 0xFF000000 : 0xFFFFFFFF)
            textoC(g, C.k, xl + lw / 2, yHit - 12, 0xFFDDDDDD)
        }
        // flechas que suben
        for (var i = 0; i < m.notas.length; i++) {
            var n = m.notas[i]
            if (n.ok == 1) continue
            var f = 1 - (n.t - t) / MG_VIAJE
            if (f < 0 || f > 1.2) continue
            var y = yBot - (yBot - yHit) * f
            var C2 = MG_CARRIL[n.c]
            var xn = x0 + n.c * lw
            var col2 = n.ok == -1 ? 0xA0606060 : C2.c
            caja(g, xn + 4, y, lw - 8, lw - 8, col2)
            marco(g, xn + 4, y, lw - 8, lw - 8, 0xFF000000)
            textoC(g, C2.fl, xn + lw / 2, y + 6, 0xFFFFFFFF)
        }
        // SICK!! / GOOD / FALLO al lado de las flechas
        if (m.txt != null && ta - m.txt.en < 500) {
            var sj = 1.8 + Math.max(0, 1 - (ta - m.txt.en) / 120) * 0.6
            textoGI(g, m.txt.s, x0 + lw * 4 + 12, yHit + 26, sj, conAlfa(m.txt.c, ta - m.txt.en > 380 ? (500 - (ta - m.txt.en)) / 120 : 1), true)
        }
        if (m.combo >= 3) textoGI(g, m.combo + 'x', x0 - 12 - ancho(m.combo + 'x') * 1.6, yHit + 26, 1.6, 0xFFFFFFFF, true)
        // Combinacion | Precision (abajo)
        var hechas = m.ac + m.fallos
        var prec = hechas > 0 ? Math.round(m.pts * 100 / hechas) : 100
        var pc = Math.round(m.ac * 100 / MG_N)
        var tb = 'Combinaci\u00F3n: ' + m.maxc + '  |  Precisi\u00F3n: ' + prec + '%'
        caja(g, W / 2 - ancho(tb) / 2 - 6, yBot + 6, ancho(tb) + 12, 13, 0xB0000000)
        textoC(g, tb, W / 2, yBot + 9, 0xFFFFFFFF)
        texto(g, 'LLUVIA DE PLOMO', x0 - 6, yHit - 24, 0xFFF0D04A, true)
        var tp = pc + '%'
        texto(g, tp, x0 + lw * 4 + 6 - ancho(tp), yHit - 24, pc >= 99 ? 0xFFFFD040 : (pc >= 50 ? 0xFF7CFF8A : 0xFFFF8080), true)
        if (m.enviado) {
            // NIVEL y da\u00F1o adicional (el DOBLE GATILLO final con tu porcentaje)
            var nv = mgNivel(m.pc)
            var tf = ta - (m.finEn || ta)
            var sN = 3.4 + Math.max(0, 1 - tf / 200) * 1.6
            textoGI(g, 'NIVEL', W / 2 - 60, Math.floor(H * 0.40), 1.6, 0xFFFFFFFF, true)
            textoGI(g, nv[0], W / 2 + 4, Math.floor(H * 0.40) - 10, sN, nv[1], true)
            var dano = m.pc >= 99 ? 40 : Math.round(8 + 24 * m.pc / 100)
            textoC(g, 'DOBLE GATILLO: da\u00F1o adicional +' + dano + (m.pc >= 99 ? '  (\u00A1100%! DOBLE)' : ''), W / 2, Math.floor(H * 0.40) + 30, 0xFFFFE080)
        } else if (t < 1500) {
            textoG(g, 'W A S D', W / 2, Math.floor(H * 0.45), 2.4, 0xFFFFFFFF)
            textoC(g, 'Aprieta cada flecha cuando llegue arriba', W / 2, Math.floor(H * 0.45) + 24, 0xFFDDDDDD)
        }
    }

    // ---- GOLPES xN (a la derecha, debajo del contragolpe) ----
    var golpesDibujar = (g, d, W, H) => {
        var tg = ahora() - BX.gol.desde
        if (BX.gol.desde <= 0 || tg >= 2000) return
        var n = BX.gol.n
        var c = n >= 10 ? 0xFFFF3B3B : (n >= 6 ? 0xFFFF8A1E : (n >= 3 ? 0xFFFFE04A : 0xFFFFFFFF))
        var a = tg > 1650 ? (2000 - tg) / 350 : 1
        var s = 2.4 + Math.max(0, 1 - tg / 160) * 0.9
        var y = Math.floor(H * 0.22) + 46
        var tn = 'x' + n
        var wN = ancho(tn) * s
        var xr = W - 12
        textoGI(g, 'GOLPES', xr - wN - ancho('GOLPES') * 1.3 - 4, y + 7 * s - 11, 1.3, conAlfa(0xFFEFEFEF, a), true)
        textoGI(g, tn, xr - wN, y, s, conAlfa(c, a), true)
        var quien = nombreDe(d, BX.gol.q)
        if (quien != '') texto(g, quien, xr - ancho(quien), y + 9 * s + 2, conAlfa(BX.gol.q == 1 ? 0xFFFF7070 : 0xFF7099FF, a), true)
    }

    // ---- CINEMATICA (ULTI de cada estilo 0..9; PF = ESQUIVA PERFECTA) ----
    // rol 1 = la lanza (o esquivo), 2 = la recibe, 3 = espectador
    var CINE = { activo: false, desde: 0, est: 0, q: 0, rol: 0, mira: null, real: null }
    // tomas: [desde, hasta, giro de la camara (respecto a mirar al otro), altura (grados), a quien mira, deriva]
    //  mira: 'o' = el otro, 'm' = yo, 'c' = el medio de los dos
    var TOMAS = [
        // 0 BOXEADOR: COMBO FINAL
        { a: [[0, 10, 30, 8, 'o', 6], [10, 24, 90, 5, 'c', 40], [24, 38, 205, -12, 'm', 8], [38, 99, -100, 15, 'o', 10]],
          v: [[0, 10, -30, 5, 'o', -6], [10, 24, -90, 5, 'c', -40], [24, 38, 155, -10, 'm', -8], [38, 99, 100, 15, 'm', -10]] },
        // 1 RELAMPAGO: ESQUIVA FANTASMA
        { a: [[0, 10, 90, 6, 'c', 10], [10, 20, 220, -15, 'm', 10], [20, 30, 20, 3, 'o', 4], [30, 99, -120, 18, 'o', 10]],
          v: [[0, 10, -25, 6, 'o', -4], [10, 20, 90, 5, 'c', 10], [20, 30, 160, -8, 'm', -4], [30, 99, -110, 15, 'm', -10]] },
        // 2 TITAN: TERREMOTO
        { a: [[0, 14, 210, -22, 'm', 8], [14, 24, 90, 35, 'c', 15], [24, 99, 60, 6, 'o', 10]],
          v: [[0, 14, -20, -5, 'o', -5], [14, 24, -90, 35, 'c', -15], [24, 99, 150, 0, 'm', -8]] },
        // 3 SUPERNOVA: brilla (de frente), 3 golpes (de lado), explota (desde arriba)
        { a: [[0, 12, 160, -10, 'm', 12], [12, 30, 75, 6, 'c', 35], [30, 42, 10, 4, 'o', 8], [42, 99, -120, 28, 'c', 20]],
          v: [[0, 12, -30, 4, 'o', -6], [12, 30, -80, 6, 'c', -30], [30, 42, 170, -8, 'm', -6], [42, 99, 115, 28, 'c', -18]] },
        // 4 ESCOPETA: minijuego (camara lenta alrededor; se ve como le pega)
        { a: [[0, 22, 165, -6, 'm', 10], [22, 110, 40, 6, 'c', 50], [110, 200, -45, 8, 'c', -50], [200, 999, 95, 18, 'c', 35]],
          v: [[0, 22, -25, 4, 'o', -5], [22, 110, -60, 6, 'c', -45], [110, 200, 55, 8, 'c', 45], [200, 999, -95, 18, 'c', -35]] },
        // 5 NECROID: QUIEBRAHUESOS (costillas de cerca en camara lenta, el uppercut y el vuelo de lado)
        { a: [[0, 10, 95, 4, 'c', 15], [10, 34, 55, 2, 'o', 25], [34, 58, 100, 10, 'o', 45], [58, 99, -130, 18, 'c', 10]],
          v: [[0, 10, -95, 4, 'c', -15], [10, 34, 160, -4, 'm', -10], [34, 58, -100, 10, 'm', -45], [58, 99, 130, 18, 'c', -10]] },
        // 6 CALLEJERO: PELEA DE BAR
        { a: [[0, 8, 120, 6, 'c', 20], [8, 20, 60, 4, 'o', 10], [20, 34, -80, 8, 'c', -20], [34, 99, 160, 15, 'o', 15]],
          v: [[0, 8, -120, 6, 'c', -20], [8, 20, 170, -6, 'm', -8], [20, 34, 80, 8, 'c', 20], [34, 99, -150, 15, 'm', -15]] },
        // 7 RANA: SALTO DE RANA (mira a un lado; desde abajo se ve la rana; vuela)
        { a: [[0, 12, 20, 5, 'o', 10], [12, 30, 95, -16, 'o', 10], [30, 99, 120, 10, 'o', 40]],
          v: [[0, 12, -20, 5, 'o', -10], [12, 30, 150, -20, 'm', 10], [30, 99, -120, 10, 'm', -40]] },
        // 8 FANTASMA: POSESION
        { a: [[0, 8, 150, -8, 'm', 10], [8, 40, 70, 6, 'o', 30], [40, 99, -100, 14, 'c', 20]],
          v: [[0, 8, -40, 4, 'o', -6], [8, 40, 160, -4, 'm', -20], [40, 99, 100, 14, 'c', -20]] },
        // 9 EMPERADOR: DECRETO REAL (de abajo como un rey, el otro se arrodilla, martillazo desde arriba)
        { a: [[0, 16, 170, -14, 'm', 12], [16, 28, 70, 10, 'o', 20], [28, 44, -60, 6, 'c', -20], [44, 99, 120, 25, 'c', 15]],
          v: [[0, 16, -30, 6, 'o', -6], [16, 28, 160, 12, 'm', -10], [28, 44, 60, 6, 'c', 20], [44, 99, -120, 25, 'c', -15]] },
        // PF ESQUIVA PERFECTA: de lado y de cerca: el pu\u00F1o pasa por encima del que se agacha
        { a: [[0, 99, 92, 2, 'c', 16]],
          v: [[0, 99, -92, 2, 'c', -16]] }
    ]
    var cineEmpezar = (d, est, q) => {
        try {
            var mc = $Minecraft.getInstance()
            if (mc.player == null || d == null) return
            var A = entidad(nombreDe(d, q)), V = entidad(nombreDe(d, 3 - q))
            if (A == null || V == null) return
            var rol = 3
            if (d.yo == q) rol = 1
            else if (d.yo > 0) rol = 2
            if (rol == 3 && Number(mc.player.distanceToEntity(A)) > 40) return
            CINE.activo = true
            CINE.desde = ahora()
            CINE.est = Math.max(0, Math.min(PF, est))
            CINE.q = q
            CINE.rol = rol
            CINE.mira = null
            // ULTI de ESCOPETA: el que la lanza juega el minijuego de flechas
            if (CINE.est == 4 && rol == 1) mgEmpezar()
        } catch (e) {
            bxLog('cine empezar', e)
            CINE.activo = false
        }
    }
    var cineTicks = () => (ahora() - CINE.desde) / 50
    // la cinematica termina sola cuando pasa su tiempo
    var cineActivo = () => {
        if (CINE.activo && cineTicks() > ULTI_DUR[CINE.est]) {
            CINE.activo = false
            CINE.mira = null
        }
        return CINE.activo
    }
    // el server avisa que termino la ULTI (#uf)
    var cineTerminar = () => {
        if (CINE.activo && CINE.est != PF && cineTicks() > 8) {
            CINE.activo = false
            CINE.mira = null
        }
    }
    // antes de dibujar el cuadro: camara de cine (se cambia la mirada SOLO para dibujar; el server
    // nunca la ve porque al terminar el cuadro se devuelve la de verdad)
    var cinePreparar = (d, pt) => {
        if (!CINE.activo) return
        var mc = $Minecraft.getInstance()
        var yo = mc.player
        var tk = cineTicks()
        if (d == null || yo == null || tk > ULTI_DUR[CINE.est]) {
            CINE.activo = false
            CINE.mira = null
            return
        }
        var A = entidad(nombreDe(d, CINE.q)), V = entidad(nombreDe(d, 3 - CINE.q))
        if (A == null || V == null) {
            CINE.mira = null
            return
        }
        var a = pos(A, pt), v = pos(V, pt)
        if (CINE.rol == 3) {
            CINE.mira = { x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 + 1.1, z: (a.z + v.z) / 2 }
            return
        }
        var yoP = CINE.rol == 1 ? a : v
        var otP = CINE.rol == 1 ? v : a
        var lista = TOMAS[CINE.est][CINE.rol == 1 ? 'a' : 'v']
        var s = lista[lista.length - 1]
        for (var i = 0; i < lista.length; i++) {
            if (tk >= lista[i][0] && tk < lista[i][1]) { s = lista[i]; break }
        }
        var fin = Math.min(s[1], ULTI_DUR[CINE.est])
        var frac = Math.max(0, Math.min(1, (tk - s[0]) / Math.max(1, fin - s[0])))
        var yawAV = angulos(yoP, otP).yaw
        var yc = yawAV + s[2] + s[5] * frac
        var pc = s[3]
        if (s[4] == 'o') CINE.mira = { x: otP.x, y: otP.y + 1.45, z: otP.z }
        else if (s[4] == 'm') CINE.mira = { x: yoP.x, y: yoP.y + 1.45, z: yoP.z }
        else CINE.mira = { x: (a.x + v.x) / 2, y: (a.y + v.y) / 2 + 1.1, z: (a.z + v.z) / 2 }
        CINE.real = { y: Number(yo.getYaw()), x: Number(yo.getPitch()), yo: Number(yo.yRotO), xo: Number(yo.xRotO) }
        yo.setYaw(yc)
        yo.setPitch(pc)
        yo.yRotO = yc
        yo.xRotO = pc
    }
    // despues de dibujar: se devuelve la mirada de verdad
    var cineDevolver = () => {
        if (CINE.real == null) return
        var r = CINE.real
        CINE.real = null
        var yo = $Minecraft.getInstance().player
        if (yo == null) return
        yo.setYaw(r.y)
        yo.setPitch(r.x)
        yo.yRotO = r.yo
        yo.xRotO = r.xo
    }

    // ---- CAMARA FIJADA: el boxeador siempre mira al rival ----
    var fijar = (d, pt, dt) => {
        if (d == null || d.yo == 0) return
        if (d.fa < 1 || d.fa > 4) return
        var mc = $Minecraft.getInstance()
        var yo = mc.player
        if (yo == null) return
        var otro = entidad(nombreDe(d, 3 - d.yo))
        if (otro == null) return
        var a = pos(yo, pt), b = pos(otro, pt)
        var ang = angulos({ x: a.x, y: a.y + 1.62, z: a.z }, { x: b.x, y: b.y + 1.25, z: b.z })
        if (ang.h < 0.3) return
        var pit = Math.max(-25, Math.min(30, ang.pitch))
        var k = 1 - Math.exp(-dt / 0.05)
        var cur = Number(yo.getYaw())
        var ny = cur + difAng(cur, ang.yaw) * k
        var cp = Number(yo.getPitch())
        var np = cp + (pit - cp) * k
        yo.setYaw(ny)
        yo.setPitch(np)
        yo.yRotO = ny
        yo.xRotO = np
        try { yo.setYHeadRot(ny) } catch (e) { }
    }

    // ---- ESQUIVA PERFECTA: blanco y negro (shader del paquete; si no, un velo gris) ----
    var GRIS = ['dinamicas:shaders/post/gris.json', 'minecraft:shaders/post/desaturate.json']
    var grisPoner = (si) => {
        if (si == BX.gris) return
        BX.gris = si
        var gr = $Minecraft.getInstance().gameRenderer
        if (!si) {
            if (BX.grisShader) {
                try { gr.shutdownEffect() } catch (e) { bxLog('gris quitar', e) }
            }
            BX.grisShader = false
            return
        }
        BX.grisShader = false
        if (BX.grisNo) return
        for (var i = 0; i < GRIS.length && !BX.grisShader; i++) {
            try {
                gr.loadEffect(rl(GRIS[i]))
                if (gr.currentEffect() != null) BX.grisShader = true
            } catch (e) {
                bxLog('gris', e)
                BX.grisNo = true
                return
            }
        }
    }
    // \u00BFsigue la camara lenta? (hasta el golpe asegurado + un poquito, o 2 s como mucho)
    var pfActivo = () => {
        var p = BX.pf
        if (!p.activo) return false
        var t = ahora()
        if ((p.fin > 0 && t - p.fin > 450) || t - p.desde > 2400) {
            p.activo = false
            return false
        }
        return true
    }
    var pfDibujar = (g, d, W, H) => {
        var t = ahora()
        var p = BX.pf
        var el = t - p.desde
        if (!BX.grisShader) caja(g, 0, 0, W, H, 0x5A303038)
        // vineta oscura en los bordes
        for (var k = 0; k < 6; k++) {
            var a = 0.10 + k * 0.03
            caja(g, 0, k * 4, W, 4, conAlfa(0xFF000000, 0.5 - a))
            caja(g, 0, H - (k + 1) * 4, W, 4, conAlfa(0xFF000000, 0.5 - a))
        }
        // ondas del tiempo (camara lenta)
        var cx = W / 2, cy = H / 2
        for (var o = 0; o < 2; o++) {
            var r = ((el / 4 + o * 90) % 180) + 10
            for (var q = 0; q < 40; q++) {
                var an = (2 * PI_ * q) / 40
                caja(g, cx + Math.cos(an) * r * 1.6, cy + Math.sin(an) * r, 2, 2, conAlfa(0xFFFFFFFF, 0.35 * (1 - r / 190)))
            }
        }
        if (p.fin > 0) {
            var tf = t - p.fin
            if (tf < 200) caja(g, 0, 0, W, H, conAlfa(0xFFFFFFFF, 0.85 * (1 - tf / 200)))
            return
        }
        var s = 2.4 + Math.max(0, 1 - el / 200) * 1.2
        textoG(g, '\u00A1ESQUIVA PERFECTA!', cx, Math.floor(H * 0.16), s, (t % 500) < 250 ? 0xFFFFFFFF : 0xFFFFD040)
        // reloj de la camara lenta (tic... tac...)
        var rx = cx, ry = Math.floor(H * 0.16) + 52, rr = 11
        caja(g, rx - rr - 2, ry - rr - 2, 2 * rr + 4, 2 * rr + 4, 0x70000000)
        for (var q2 = 0; q2 < 24; q2++) {
            var an2 = (2 * PI_ * q2) / 24
            caja(g, rx + Math.cos(an2) * rr - 1, ry + Math.sin(an2) * rr - 1, 2, 2, 0xC0FFFFFF)
        }
        var ag = -PI_ / 2 + Math.floor(el / 500) * (PI_ / 6)
        for (var q3 = 0; q3 < rr - 2; q3 += 2) caja(g, rx + Math.cos(ag) * q3 - 1, ry + Math.sin(ag) * q3 - 1, 2, 2, 0xFFFFD040)
        var fr = Math.max(0, 2000 - el)
        var pz = g.pose()
        pz.pushPose()
        pz.scale(0.5, 0.5, 1)
        var tt = (fr / 1000).toFixed(1) + ' s'
        texto(g, tt, rx * 2 - ancho(tt) / 2, (ry + rr + 4) * 2, 0xFFDDDDDD, true)
        pz.popPose()
        var quien = nombreDe(d, p.q)
        if (d.yo == p.q) {
            textoC(g, '\u00A1GOLPE SEGURO! CLIC = golpe \u00B7 CLIC DERECHO = fuerte \u00B7 ' + nombreTecla(TECLA.ulti, 'R') + ' = ULTI', cx, Math.floor(H * 0.16) + 28, 0xFFFFE080)
        } else if (d.yo > 0) {
            textoC(g, '\u00A1Fallaste! ' + quien + ' te va a dar un golpe seguro...', cx, Math.floor(H * 0.16) + 28, 0xFFFF8080)
        } else if (quien != '') {
            textoC(g, quien + ' esquiv\u00F3 a la perfecci\u00F3n', cx, Math.floor(H * 0.16) + 28, 0xFFDDDDDD)
        }
    }

    // ---- RULETA DE ESTILOS (pantalla completa, como la del video) ----
    // [estilo, probabilidad]: giro normal y GIRO DE LA SUERTE (solo MITICO, LEGENDARIO y LIMITADO)
    var POZO = [[0, 30], [6, 30], [1, 9], [2, 9], [7, 9], [3, 4], [8, 4], [4, 2], [9, 2], [5, 1]]
    var POZO_SUERTE = [[3, 32.5], [8, 32.5], [4, 14], [9, 14], [5, 7]]
    // tipo: 0 normal, 1 suerte, 2 regalo (no gira: sale directo)
    var giroEmpezar = (res, tipo) => {
        if (tipo == 2) {
            BX.giro = { desde: ahora() - GIRO_MS, res: res, items: [res], tipo: 2 }
            return
        }
        var pozo = tipo == 1 ? POZO_SUERTE : POZO
        var items = []
        for (var i = 0; i < 24; i++) {
            var r = Math.random() * 100, acc = 0, e = pozo[0][0]
            for (var j = 0; j < pozo.length; j++) {
                acc += pozo[j][1]
                if (r < acc) { e = pozo[j][0]; break }
            }
            items.push(e)
        }
        items.push(res)
        BX.giro = { desde: ahora(), res: res, items: items, tipo: tipo }
    }
    var GIRO_MS = 3000
    // lo que muestra la ruleta ahora: { e, girando, nuevo, aura }
    var giroActual = (est) => {
        var g = BX.giro
        var miEst = est != null ? est.es : 0
        if (g == null) return { e: miEst, girando: false, nuevo: false, aura: false }
        var el = ahora() - g.desde
        if (el >= GIRO_MS) return { e: g.res, girando: false, nuevo: el < GIRO_MS + 1800, aura: el < GIRO_MS + 4500 && estilo(g.res).tier >= 2 }
        var p = el / GIRO_MS
        var idx = Math.min(g.items.length - 1, Math.floor(g.items.length * (1 - Math.pow(1 - p, 2.2))))
        return { e: g.items[idx], girando: true, nuevo: false, aura: false }
    }
    var peleando = (d) => d != null && d.yo > 0 && d.fa != 5
    // el mini menu ESTILOS: mini boxeo (lobby) y espectadores; los que pelean no lo ven
    var widgetVisible = (d, est) => est != null && !peleando(d)

    // mini menu "ESTILOS" (encima del de la musica)
    var widgetCaja = () => {
        var win = $Minecraft.getInstance().getWindow()
        var W = Number(win.getGuiScaledWidth()), H = Number(win.getGuiScaledHeight())
        var w = 150, h = 40
        return { x: W - w - 3, y: Math.max(48, H - 16 - 78 - 6 - h), w: w, h: h }
    }
    var widgetDibujar = (g, est, activo, mx, my) => {
        var c = widgetCaja()
        var ga = giroActual(est)
        var tr = estilo(ga.e).tier
        var hv = activo && dentro(mx, my, c.x, c.y, c.w, c.h)
        caja(g, c.x, c.y, c.w, c.h, hv ? 0xE0283048 : (activo ? 0xD0101018 : 0x80000000))
        caja(g, c.x, c.y, c.w, 1, colorTier(tr))
        texto(g, '\u2605 ESTILOS', c.x + 4, c.y + 3, 0xFFFFC94A, true)
        var der = activo ? 'ABRIR' : '[T] o [' + nombreTecla(TECLA.estilos, 'Y') + ']'
        texto(g, der, c.x + c.w - 4 - ancho(der), c.y + 3, activo ? (hv ? 0xFFFFFF55 : 0xFFDDDDDD) : 0xFF888888, true)
        var linea = ga.girando ? 'GIRANDO...  ' + estilo(ga.e).nom : TIERS[tr].nom + ' \u00B7 ' + estilo(ga.e).nom
        if (ga.nuevo && (ahora() % 400) < 200) linea = '\u00A1NUEVO! ' + linea
        texto(g, linea, c.x + 4, c.y + 16, colorTier(tr), true)
        var gr = 'Giros: ' + Math.max(0, est.gr) + '  \u00B7  \u2605 Suerte: ' + Math.max(0, est.gl)
        texto(g, gr, c.x + 4, c.y + 28, est.gr > 0 || est.gl > 0 ? 0xFFB0FFB0 : 0xFFFF8080, true)
    }

    // cajas de la ruleta (pantalla completa)
    var ruletaCaja = () => {
        var win = $Minecraft.getInstance().getWindow()
        var W = Number(win.getGuiScaledWidth()), H = Number(win.getGuiScaledHeight())
        var c = { W: W, H: H, cx: Math.floor(W / 2) }
        c.volver = { x: 6, y: 6, w: 54, h: 16 }
        c.slots = []
        var sw = Math.min(96, Math.floor(W * 0.2)), sh = 54
        var sy = Math.max(30, Math.floor(H / 2 - (sh * 3 + 12) / 2))
        for (var i = 0; i < 3; i++) {
            var s = { x: 8, y: sy + i * (sh + 6), w: sw, h: sh }
            s.bt = { x: s.x + 6, y: s.y + 24, w: sw - 12, h: 14 }
            s.gd = { x: s.x + 6, y: s.y + 40, w: sw - 12, h: 11 }
            c.slots.push(s)
        }
        var tw = Math.min(150, Math.floor(W * 0.3))
        c.tiers = { x: W - tw - 8, y: 8, w: tw }
        var bw = Math.min(120, Math.floor(W * 0.24)), bh = 26
        c.girar = { x: c.cx - bw - 5, y: H - 46, w: bw, h: bh }
        c.suerte = { x: c.cx + 5, y: H - 46, w: bw, h: bh }
        return c
    }
    var chispas = []
    for (var si = 0; si < 60; si++) chispas.push([(si * 7919) % 1000 / 1000, (si * 104729) % 997 / 997, si])
    var botonDibujar = (g, b, txt, c1, c2, hv, ok, esc) => {
        caja(g, b.x - 1, b.y - 1, b.w + 2, b.h + 2, 0xFF000000)
        if (ok) {
            caja(g, b.x, b.y, b.w, b.h / 2, hv ? (c1 | 0x00202020) : c1)
            caja(g, b.x, b.y + b.h / 2, b.w, b.h - b.h / 2, hv ? (c2 | 0x00202020) : c2)
        } else {
            caja(g, b.x, b.y, b.w, b.h, 0xFF3A3A3A)
        }
        if (esc > 1) textoG(g, txt, b.x + b.w / 2, b.y + (b.h - 8 * esc) / 2, esc, ok ? 0xFFFFFFFF : 0xFF8A8A8A)
        else textoC(g, txt, b.x + b.w / 2, b.y + (b.h - 8) / 2, ok ? 0xFFFFFFFF : 0xFF8A8A8A)
    }
    // AURA EPICA del personaje (textura animada del paquete: 8 cuadros de 64x128 uno debajo del otro)
    //  MITICO morada, LEGENDARIO amarilla (como el ki de Goku), LIMITADO roja y negra
    var auraDibujar = (g, tr, cx, piso, esm, fuerza, delante) => {
        var T = TIERS[tr]
        if (T == null || T.aura == null) return
        var t = ahora()
        var tex = 'dinamicas:textures/gui/boxeo/aura_' + T.aura + '.png'
        var w = esm * 2.3, h = esm * 3.4
        var x = cx - w / 2, y = piso - h * 0.93
        if (existe(tex)) {
            var fr = Math.floor(t / 70) % 8
            var a = delante ? 0.42 * fuerza : 0.95 * fuerza
            g.setColor(1, 1, 1, Math.max(0.03, Math.min(1, a)))
            g.blit(rl(tex), Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, fr * 128, 64, 128, 64, 1024)
            g.setColor(1, 1, 1, 1)
            return
        }
        // sin el paquete: llamas de cuadritos que suben
        var cT = colorTier(tr)
        var n = delante ? 18 : 40
        for (var q = 0; q < n; q++) {
            var ch = chispas[q % chispas.length]
            var f = ((t + ch[2] * 137) % 900) / 900
            var px = cx + (ch[0] - 0.5) * w * (1 - f * 0.5)
            var py = piso - f * h
            caja(g, px, py, 3, 5, conAlfa(q % 3 == 0 ? 0xFFFFFFFF : cT, (1 - f) * fuerza))
        }
    }
    var ruletaDibujar = (g, d, est, mx, my) => {
        var c = ruletaCaja()
        var W = c.W, H = c.H, cx = c.cx
        var t = ahora()
        var ga = giroActual(est)
        var es = estilo(ga.e)
        var tr = es.tier
        var cT = colorTier(tr)
        // fondo negro con rayas diagonales suaves (como el video)
        caja(g, 0, 0, W, H, 0xFF07080B)
        for (var k = 0; k < 14; k++) {
            var xs = ((k * 97 + t / 40) % (W + H)) - H
            for (var yy = 0; yy < H; yy += 6) caja(g, xs + yy * 0.6, yy, 2, 6, 0x0CFFFFFF)
        }
        // brillo detras del personaje
        var mxc = cx, myc = Math.floor(H * 0.56)
        for (var r2 = 5; r2 >= 1; r2--) caja(g, mxc - r2 * 18, myc - r2 * 22, r2 * 36, r2 * 44, conAlfa(cT, 0.025))
        // ESTILO ACTUAL + nombre grande
        textoC(g, ga.girando ? 'GIRANDO...' : 'ESTILO ACTUAL:', cx, 8, 0xFFFFFFFF)
        var nom = es.nom
        var esc = Math.min(3.2, (W * 0.46) / Math.max(1, ancho(nom) + nom.length))
        var p = g.pose()
        p.pushPose()
        p.scale(esc, esc, 1)
        textoBI(g, nom, (cx - (ancho(nom) + nom.length) * esc / 2) / esc, 19 / esc, cT, true)
        p.popPose()
        var yT = 20 + 9 * esc
        textoC(g, '\u2605 ' + TIERS[tr].nom + ' \u2605', cx, yT, cT)
        if (!ga.girando && !ga.aura && !ga.nuevo && H >= 230) {
            // descripcion (letra un poco mas chica para no tapar al personaje)
            var dw = Math.min(330, W * 0.5)
            var pd = g.pose()
            pd.pushPose()
            pd.scale(0.8, 0.8, 1)
            parrafo(g, es.desc, (cx - dw / 2) / 0.8, (yT + 11) / 0.8, dw / 0.8, 0xFFD8D8D8)
            pd.popPose()
        }
        // el personaje (tu skin) en el medio, grande, con su AURA (MITICO, LEGENDARIO y LIMITADO)
        var esm = Math.max(30, Math.min(64, Math.floor(H * 0.2)))
        var pisoM = myc + esm * 1.05
        var fuerzaAura = ga.girando ? 0 : (ga.aura ? 1 : 0.55)
        if (tr >= 2 && fuerzaAura > 0) auraDibujar(g, tr, mxc, pisoM + esm * 0.15, esm, fuerzaAura, false)
        if ($InvScreen != null) {
            try {
                var yo = $Minecraft.getInstance().player
                if (yo != null) $InvScreen.renderEntityInInventoryFollowsMouse(g, Math.round(mxc), Math.round(myc + esm * 1.05), esm, mxc - mx, myc - esm * 0.6 - my, yo)
            } catch (e2) {
                bxLog('personaje', e2)
                $InvScreen = null
            }
        }
        if (tr >= 2 && fuerzaAura > 0) auraDibujar(g, tr, mxc, pisoM + esm * 0.15, esm, fuerzaAura, true)
        // particulas alrededor mientras gira / aura si salio MITICO, LEGENDARIO o LIMITADO
        if (ga.girando || ga.aura) {
            var nP = ga.aura ? 46 : 26
            for (var q = 0; q < nP; q++) {
                var ch = chispas[q % chispas.length]
                var vel = ga.aura ? 900 : 1400
                var f = ((t + ch[2] * 137) % vel) / vel
                var an = ch[0] * 2 * PI_ + t / (ga.aura ? 500 : 300)
                var rx = esm * (0.7 + 0.25 * ch[1]), ry = esm * 1.15
                var px = mxc + Math.cos(an) * rx
                var py = ga.aura ? myc + esm * 0.9 - f * esm * 2.2 : myc + Math.sin(an) * ry * 0.9
                var s2 = ga.aura ? 3 : 2
                caja(g, px, py, s2, s2, conAlfa(q % 3 == 0 ? 0xFFFFFFFF : cT, ga.aura ? 1 - f * 0.8 : 0.8))
            }
        }
        if (ga.aura) {
            var tA = t - BX.giro.desde - GIRO_MS
            textoG(g, '\u00A1' + TIERS[tr].nom + '!', cx, yT + 14, 2.2 + Math.max(0, 1 - tA / 200), (t % 400) < 200 ? 0xFFFFFFFF : cT)
            textoC(g, BX.giro.tipo == 2 ? '\u00A1Te lo regalaron! (se guard\u00F3 solo)' : '\u00A1Farmeando aura! (se guard\u00F3 solo)', cx, yT + 38, 0xFFFFE080)
            if (tA < 220) caja(g, 0, 0, W, H, conAlfa(cT, 0.5 * (1 - tA / 220)))
        } else if (ga.nuevo) {
            textoC(g, BX.giro.tipo == 2 ? '\u00A1REGALO! (se guard\u00F3 solo)' : '\u00A1NUEVO ESTILO! (se guard\u00F3 solo)', cx, yT + 16, (t % 400) < 200 ? 0xFFFFFF55 : 0xFFFFD040)
        }
        // VOLVER
        var v = c.volver
        var hvv = dentro(mx, my, v.x, v.y, v.w, v.h)
        caja(g, v.x, v.y, v.w, v.h, hvv ? 0xFF3A3A48 : 0xFF1A1A22)
        marco(g, v.x, v.y, v.w, v.h, 0xFF606070)
        textoC(g, '< VOLVER', v.x + v.w / 2, v.y + 4, 0xFFFFFFFF)
        // ranuras (izquierda): 1, 2 y el estilo que llevas
        var libre = !peleando(d)
        for (var i = 0; i < 3; i++) {
            var s = c.slots[i]
            var se = i == 0 ? est.s1 : (i == 1 ? est.s2 : est.es)
            if (i == 2 && ga.girando) se = -2
            caja(g, s.x, s.y, s.w, s.h, 0xFF14161C)
            marco(g, s.x, s.y, s.w, s.h, se >= 0 ? colorTier(estilo(se).tier) : 0xFF404048)
            var et = i < 2 ? 'RANURA ' + (i + 1) : 'TU ESTILO'
            var pz = g.pose()
            pz.pushPose()
            pz.scale(0.5, 0.5, 1)
            texto(g, et, (s.x + 3) * 2, (s.y + 2) * 2, 0xFF9090A0, true)
            pz.popPose()
            var sn = se >= 0 ? estilo(se).nom : (se == -2 ? '???' : 'VAC\u00CDA')
            textoC(g, sn, s.x + s.w / 2, s.y + 10, se >= 0 ? colorTier(estilo(se).tier) : 0xFF707070)
            if (i == 2) {
                botonDibujar(g, s.bt, 'EQUIPADO', 0xFF2F8F3F, 0xFF1F6A2C, false, true, 1)
                continue
            }
            var equipado = se >= 0 && se == est.es
            var okE = se >= 0 && !equipado && libre
            botonDibujar(g, s.bt, equipado ? 'EQUIPADO' : 'EQUIPAR', equipado ? 0xFF2F8F3F : 0xFFE0485C, equipado ? 0xFF1F6A2C : 0xFFB02A3E,
                okE && dentro(mx, my, s.bt.x, s.bt.y, s.bt.w, s.bt.h), okE || equipado, 1)
            var hg = libre && dentro(mx, my, s.gd.x, s.gd.y, s.gd.w, s.gd.h)
            caja(g, s.gd.x, s.gd.y, s.gd.w, s.gd.h, hg ? 0xFF3A4A6A : 0xFF20283A)
            pz.pushPose()
            pz.scale(0.5, 0.5, 1)
            var gt = 'GUARDAR EL ACTUAL AQU\u00CD'
            texto(g, gt, (s.gd.x + s.gd.w / 2) * 2 - ancho(gt) / 2, (s.gd.y + 3) * 2, libre ? 0xFFDDE6FF : 0xFF707070, true)
            pz.popPose()
        }
        // categorias (derecha) con su probabilidad y sus estilos
        var yy2 = c.tiers.y
        for (var q2 = 0; q2 < TIERS.length; q2++) {
            var T = TIERS[q2]
            var x = c.tiers.x, w = c.tiers.w, h = 15
            if (T.limitado) {
                for (var z = 0; z < w; z += 6) {
                    var fz = (Math.sin(t / 220 + z / 14) + 1) / 2
                    var rr = Math.round(40 + 200 * fz), gg = Math.round(4 + 20 * fz), bb = Math.round(8 + 30 * fz)
                    caja(g, x + z, yy2, Math.min(6, w - z), h, col(0xFF000000 | (rr << 16) | (gg << 8) | bb))
                }
            } else {
                caja(g, x, yy2, w, h, colorTier(q2))
                caja(g, x, yy2 + h - 3, w, 3, T.o)
            }
            marco(g, x, yy2, w, h, q2 == tr && !ga.girando ? 0xFFFFFFFF : 0xFF000000)
            textoBI(g, T.nom + ' (' + T.pct + '%)', x + 4, yy2 + 4, 0xFFFFFFFF, true)
            if (T.su > 0) {
                var pzs = g.pose()
                pzs.pushPose()
                pzs.scale(0.5, 0.5, 1)
                var st2 = '\u2605 ' + T.su + '%'
                texto(g, st2, (x + w - 14) * 2 - ancho(st2), (yy2 + 5) * 2, 0xFFFFF0A0, true)
                pzs.popPose()
            }
            texto(g, '\u25BC', x + w - 10, yy2 + 4, 0xFFFFFFFF, true)
            texto(g, T.lista, x + 4, yy2 + h + 2, 0xFFBBBBBB, true)
            yy2 += h + 15
        }
        // GIRAR (o SALTAR mientras gira), GIRO DE LA SUERTE y los giros que quedan
        var b = c.girar
        var okG = libre && (ga.girando || est.gr > 0)
        var hb = okG && dentro(mx, my, b.x, b.y, b.w, b.h)
        botonDibujar(g, b, ga.girando ? 'SALTAR' : 'GIRAR', 0xFF6BE35A, 0xFF3FB43A, hb, okG, 2)
        var bs = c.suerte
        var okS = libre && !ga.girando && est.gl > 0
        var hs = okS && dentro(mx, my, bs.x, bs.y, bs.w, bs.h)
        botonDibujar(g, bs, '\u2605 SUERTE', 0xFFFFD040, 0xFFE09A10, hs, okS, 2)
        var nota = !libre ? 'No puedes girar mientras peleas' : 'Giros: ' + Math.max(0, est.gr) + '   \u00B7   Giros de la suerte: ' + Math.max(0, est.gl)
        textoC(g, nota, cx, b.y + b.h + 5, !libre || (est.gr <= 0 && est.gl <= 0) ? 0xFFFF7070 : 0xFFFFFFFF)
        var gp = 'Gana: +10 giros \u00B7 pierde: +5 \u00B7 RACHA ' + Math.max(0, est.rc) + '/3 = +5 de la suerte'
        textoC(g, gp, cx, b.y - 12, 0xFF9AA0B0)
    }
    // clic en la ruleta
    var ruletaClic = (d, est, x, y) => {
        var c = ruletaCaja()
        var t = ahora()
        if (dentro(x, y, c.volver.x, c.volver.y, c.volver.w, c.volver.h)) {
            BX.ruleta = false
            try { $Minecraft.getInstance().setScreen(null) } catch (e) { }
            return
        }
        var libre = !peleando(d)
        var b = c.girar
        if (dentro(x, y, b.x, b.y, b.w, b.h)) {
            var ga = giroActual(est)
            if (ga.girando) {
                BX.giro.desde = t - GIRO_MS   // SALTAR: se ve el resultado ya
                return
            }
            if (!libre || est.gr <= 0 || t - BX.giroPedido < 1200) return
            BX.giroPedido = t
            comando('bxestilo girar')
            return
        }
        var bs = c.suerte
        if (dentro(x, y, bs.x, bs.y, bs.w, bs.h)) {
            var ga2 = giroActual(est)
            if (ga2.girando || !libre || est.gl <= 0 || t - BX.giroPedido < 1200) return
            BX.giroPedido = t
            comando('bxestilo suerte')
            return
        }
        if (!libre) return
        for (var i = 0; i < 2; i++) {
            var s = c.slots[i]
            if (dentro(x, y, s.bt.x, s.bt.y, s.bt.w, s.bt.h)) {
                comando('bxestilo equipar ' + (i + 1))
                return
            }
            if (dentro(x, y, s.gd.x, s.gd.y, s.gd.w, s.gd.h)) {
                comando('bxestilo guardar ' + (i + 1))
                return
            }
        }
    }

    // ---- RUEDA DE GESTOS (tecla B) ----
    var GESTOS = [['karaoke', 'KARAOKE', 0xFFFF5FC8], ['hakari', 'HAKARI', 0xFF4CFF6A], ['tomarl', 'TOMAR LA L', 0xFFFFD040],
                  ['aura', 'FARMEAR AURA', 0xFFC65CFF], ['victoria', 'VICTORIA', 0xFF3FD0FF], ['parar', 'PARAR', 0xFFFF5050]]
    var ruedaPos = (k) => {
        var win = $Minecraft.getInstance().getWindow()
        var W = Number(win.getGuiScaledWidth()), H = Number(win.getGuiScaledHeight())
        var an = -PI_ / 2 + (2 * PI_ * k) / GESTOS.length
        var r = Math.min(80, H * 0.3)
        return { x: W / 2 + Math.cos(an) * r * 1.3 - 40, y: H / 2 + Math.sin(an) * r - 11, w: 80, h: 22 }
    }
    var ruedaDibujar = (g, mx, my) => {
        var win = $Minecraft.getInstance().getWindow()
        var W = Number(win.getGuiScaledWidth()), H = Number(win.getGuiScaledHeight())
        caja(g, 0, 0, W, H, 0x90000000)
        textoG(g, 'GESTOS', W / 2, H / 2 - 8, 1.8, 0xFFFFFFFF)
        textoC(g, 'clic para bailar', W / 2, H / 2 + 10, 0xFFAAAAAA)
        for (var k = 0; k < GESTOS.length; k++) {
            var b = ruedaPos(k)
            var hv = dentro(mx, my, b.x, b.y, b.w, b.h)
            caja(g, b.x, b.y, b.w, b.h, hv ? conAlfa(GESTOS[k][2], 0.9) : 0xE0141418)
            marco(g, b.x, b.y, b.w, b.h, GESTOS[k][2])
            textoC(g, GESTOS[k][1], b.x + b.w / 2, b.y + 7, hv ? 0xFF000000 : 0xFFFFFFFF)
        }
    }
    var ruedaClic = (x, y) => {
        for (var k = 0; k < GESTOS.length; k++) {
            var b = ruedaPos(k)
            if (dentro(x, y, b.x, b.y, b.w, b.h)) {
                comando('bxgesto ' + GESTOS[k][0])
                BX.rueda = false
                try { $Minecraft.getInstance().setScreen(null) } catch (e) { }
                return
            }
        }
    }

    // ---- ESPECTADOR: boton SALIR DE ESPECTADOR (a la derecha) ----
    var salirCaja = () => {
        var win = $Minecraft.getInstance().getWindow()
        var W = Number(win.getGuiScaledWidth()), H = Number(win.getGuiScaledHeight())
        return { x: W - 128, y: Math.floor(H * 0.30), w: 122, h: 22 }
    }
    var salirDibujar = (g, activo, mx, my) => {
        var b = salirCaja()
        var hv = activo && dentro(mx, my, b.x, b.y, b.w, b.h)
        botonDibujar(g, b, 'SALIR DE ESPECTADOR', 0xFFE0485C, 0xFFB02A3E, hv, true, 1)
        var nota = activo ? 'clic para volver al lobby' : '[T] y clic  \u00B7  o SHIFT'
        texto(g, nota, b.x + b.w - ancho(nota), b.y + b.h + 3, 0xFFCCCCCC, true)
    }
    var esEspectador = (d, est) => est != null && est.rv > 0 && (d == null || d.yo == 0)

    // ---- BAILE DE VICTORIA (marcador "winhud" del server) ----
    var winLeer = () => {
        var mc = $Minecraft.getInstance()
        if (mc.level == null) return null
        var sb = mc.level.getScoreboard()
        var obj = sb.getObjective('winhud')
        if (obj == null) return null
        var val = (k) => sb.hasPlayerScore(k, obj) ? Number(sb.getOrCreatePlayerScore(k, obj).getScore()) : null
        if (val('#on') != 1) return null
        var w = { id: val('#id'), g: val('#g') || 0, gan: [] }
        var it = sb.getTrackedPlayers().iterator()
        while (it.hasNext()) {
            var dueno = String(it.next())
            if (dueno.length < 1 || dueno.charAt(0) == '#') continue
            if (!sb.hasPlayerScore(dueno, obj)) continue
            w.gan.push({ n: dueno, o: Number(sb.getOrCreatePlayerScore(dueno, obj).getScore()) })
        }
        w.gan.sort((a, b) => a.o - b.o)
        return w
    }
    var winDibujar = (g, w) => {
        if (w.id != BX.win.id) {
            BX.win.id = w.id
            BX.win.desde = ahora()
        }
        var gi = Math.max(0, Math.min(WIN_G.length - 1, w.g))
        var k = Math.max(0, Math.min(99, Math.floor((ahora() - BX.win.desde) / 50)))
        var fr = WIN_SEQ[gi][k] || 0
        var filas = Math.ceil(WIN_N[gi] / 16)
        var win = $Minecraft.getInstance().getWindow()
        var W = Number(win.getGuiScaledWidth()), H = Number(win.getGuiScaledHeight())
        var n = Math.min(4, w.gan.length)
        if (n <= 0) return
        var hh = 88, ww = 66, paso = 60
        var y = Math.min(Math.floor(H / 2) + 30, H - hh - 4)
        var x = Math.floor(W / 2 - (paso * (n - 1) + ww) / 2)
        for (var i = 0; i < n; i++) {
            var nm = w.gan[i].n.toLowerCase()
            var tex = 'colores:textures/emo/' + nm + '_' + WIN_G[gi] + '.png'
            if (!existe(tex)) tex = 'colores:textures/emo/steve_' + WIN_G[gi] + '.png'
            if (!existe(tex)) continue
            g.blit(rl(tex), x + i * paso, y, ww, hh, (fr % 16) * 72, Math.floor(fr / 16) * 96, 72, 96, 1152, filas * 96)
        }
    }

    // ---- efectos de la cinematica (franjas negras, rayas, ULTIMATE!, destellos y el fondo de cada estilo) ----
    var cineDibujar = (g, d, W, H) => {
        var t = ahora()
        var el = t - CINE.desde
        var tk = el / 50
        var dur = ULTI_DUR[CINE.est] * 50
        var entra = Math.min(1, el / 220), sale = Math.min(1, Math.max(0, (dur - el) / 260))
        var fb = Math.round(H * 0.11 * Math.min(entra, sale))
        var tim = t - BX.imp
        // fondo segun el estilo
        if (CINE.est == 3) {
            // SUPERNOVA: brillo naranja que crece y explota
            var cr = Math.min(1, tk / 40)
            caja(g, 0, 0, W, H, conAlfa(0xFFFF8A20, 0.08 + 0.14 * cr))
            if (tk > 42 && tk < 50) caja(g, 0, 0, W, H, conAlfa(0xFFFFF0C0, 0.9 * (1 - (tk - 42) / 8)))
        } else if (CINE.est == 5) {
            // NECROID: todo se oscurece en rojo sangre; destello rojo al romper las costillas y al uppercut
            var ga2 = Math.min(1, tk / 8) * Math.min(1, sale * 2)
            caja(g, 0, 0, W, H, conAlfa(0xFF2A0006, 0.45 * ga2))
            for (var e = 0; e < 8; e++) {
                caja(g, 0, e * 5, W, 5, conAlfa(0xFF000000, 0.35 - e * 0.04))
                caja(g, 0, H - (e + 1) * 5, W, 5, conAlfa(0xFF000000, 0.35 - e * 0.04))
            }
            if (tk > 10 && tk < 16) caja(g, 0, 0, W, H, conAlfa(0xFFFF2030, 0.6 * (1 - (tk - 10) / 6)))
            if (tk > 34 && tk < 40) caja(g, 0, 0, W, H, conAlfa(0xFFFFFFFF, 0.8 * (1 - (tk - 34) / 6)))
        } else if (CINE.est == 4) {
            caja(g, 0, 0, W, H, conAlfa(0xFF3A2A10, 0.18))
        } else if (CINE.est == 6) {
            // CALLEJERO: luz de bar (naranja sucio)
            caja(g, 0, 0, W, H, conAlfa(0xFF5A3010, 0.16))
        } else if (CINE.est == 7) {
            // RANA: verde pantano; al mandarlo a volar, destello
            caja(g, 0, 0, W, H, conAlfa(0xFF1E5A1A, 0.14))
            if (tk > 32 && tk < 38) caja(g, 0, 0, W, H, conAlfa(0xFFCCFFAA, 0.8 * (1 - (tk - 32) / 6)))
        } else if (CINE.est == 8) {
            // FANTASMA: frio y azul, se mueve como humo
            var fo = (Math.sin(t / 300) + 1) / 2
            caja(g, 0, 0, W, H, conAlfa(0xFF103A4A, 0.22 + 0.08 * fo))
        } else if (CINE.est == 9) {
            // EMPERADOR: rayos dorados desde arriba
            caja(g, 0, 0, W, H, conAlfa(0xFF4A3A08, 0.16))
            for (var rz = 0; rz < 6; rz++) {
                var xr = ((rz * 131 + t / 30) % (W + 60)) - 30
                caja(g, xr, 0, 10, H, conAlfa(0xFFFFE070, 0.06))
            }
            if (tk > 44 && tk < 50) caja(g, 0, 0, W, H, conAlfa(0xFFFFF0B0, 0.85 * (1 - (tk - 44) / 6)))
        }
        caja(g, 0, 0, W, fb, 0xFF000000)
        caja(g, 0, H - fb, W, fb, 0xFF000000)
        // rayas de velocidad: al empezar y en cada impacto
        var rayas = el < 1300 || (BX.imp > CINE.desde && tim < 450)
        if (rayas) {
            var cols = CINE.est == 5 ? [0xFFFF2E3E, 0xFFFFFFFF, 0xFF7A0010, 0xFFFF8080] : (CINE.est == 3 ? [0xFFFFC060, 0xFFFFFFFF, 0xFFFF7A30, 0xFFFFE0A0] : (CINE.est == 9 ? [0xFFFFE070, 0xFFFFFFFF, 0xFFFFC020, 0xFFFFF0B0] : [0xFF8FE6FF, 0xFFFFFFFF, 0xFFFF6FB0, 0xFF6F8BFF]))
            for (var r = 0; r < 16; r++) {
                var semilla = Math.floor(t / 60) * 31 + r * 97
                var yy = fb + 4 + (semilla * 13) % Math.max(1, H - 2 * fb - 8)
                var ln = 40 + (semilla * 7) % 160
                var xx = ((semilla * 29 + t * 2.4) % (W + ln)) - ln
                caja(g, xx, yy, ln, 1 + (r % 2), conAlfa(cols[r % 4], 0.55))
            }
        }
        // ULTIMATE! (entra deslizando desde la izquierda) + nombre de la ULTI
        var es = estilo(CINE.est)
        var xs = 18 - Math.max(0, 1 - el / 260) * 220
        var ys = Math.floor(H * 0.58)
        var al = Math.min(1, sale * 1.5)
        if (CINE.est == 4 && BX.mg != null) al = Math.max(0, 1 - el / 1600)   // que no tape el minijuego
        if (al > 0.04) {
            for (var s = 2; s >= 0; s--) {
                textoGI(g, 'ULTIMATE!', xs - s * 9 * Math.max(0, 1 - el / 400), ys, 3, conAlfa(s == 0 ? 0xFFEFFBFF : 0xFF5FC8FF, al * (s == 0 ? 1 : 0.35)), true)
            }
            textoGI(g, es.ulti, xs + 2, ys + 30, 1.6, conAlfa(colorTier(es.tier), al), true)
            var quien = nombreDe(d, CINE.q)
            if (quien != '') texto(g, quien + ' \u00B7 ' + es.nom, xs + 2, ys + 46, conAlfa(0xFFDDDDDD, al), true)
        }
        // destello blanco al empezar y en cada impacto
        if (el < 180) caja(g, 0, 0, W, H, conAlfa(0xFFFFFFFF, 0.8 * (1 - el / 180)))
        if (BX.imp > 0 && tim < 160) caja(g, 0, 0, W, H, conAlfa(0xFFFFFFFF, (CINE.est == 4 ? 0.3 : 0.7) * (1 - tim / 160)))
    }
    // la mini cinematica de la ESQUIVA PERFECTA: solo franjas
    var cinePfDibujar = (g, W, H) => {
        var el = ahora() - CINE.desde
        var dur = ULTI_DUR[PF] * 50
        var fb = Math.round(H * 0.09 * Math.min(1, el / 150, Math.max(0, (dur - el) / 200)))
        caja(g, 0, 0, W, fb, 0xFF000000)
        caja(g, 0, H - fb, W, fb, 0xFF000000)
    }

    var bxDibujar = (g, d) => {
        var win = $Minecraft.getInstance().getWindow()
        var W = Number(win.getGuiScaledWidth())
        var H = Number(win.getGuiScaledHeight())
        var cx = Math.floor(W / 2)
        var t = ahora()
        blend(true)
        var enCine = cineActivo()
        var enPf = pfActivo()
        if (enPf) pfDibujar(g, d, W, H)
        if (enCine && CINE.est == PF) cinePfDibujar(g, W, H)
        else if (enCine) cineDibujar(g, d, W, H)
        // ---------- arriba: los 2 boxeadores ----------
        var TW = Math.min(W - 16, 420)
        var half = Math.floor(TW / 2)
        var y0 = 3
        caja(g, cx - half - 4, y0 - 2, TW + 8, 40, 0x70000000)
        barraJugador(g, d, 1, cx, half, y0)
        barraJugador(g, d, 2, cx, half, y0)
        // centro: ronda (y el ring)
        caja(g, cx - 10, y0 + 8, 20, 12, 0xFF101010)
        marco(g, cx - 10, y0 + 8, 20, 12, 0xFFF0C040)
        textoC(g, 'R' + d.rd, cx, y0 + 10, 0xFFFFE080)
        var pz = g.pose()
        pz.pushPose()
        pz.scale(0.5, 0.5, 1)
        var rt = 'RING ' + d.r
        texto(g, rt, cx * 2 - ancho(rt) / 2, (y0 + 23) * 2, 0xFFB0B0B0, true)
        pz.popPose()
        // ---------- avisos ----------
        // CONTRAGOLPE: a la derecha, naranja, 2 s
        var tcg = t - BX.cg.desde
        if (BX.cg.desde > 0 && tcg < 2000) {
            var desl = Math.max(0, 1 - tcg / 180) * 170
            var iw = 150, ih = 33
            var xx = W - iw - 6 + desl, yy = Math.floor(H * 0.22)
            if (!imagen(g, 'dinamicas:textures/gui/boxeo/contragolpe.png', xx, yy, iw, ih, 288, 64, 1)) {
                var p0 = g.pose(); p0.pushPose(); p0.scale(1.6, 1.6, 1)
                texto(g, '\u00A1CONTRAGOLPE!', (xx + 6) / 1.6, (yy + 8) / 1.6, 0xFFFF8800, true)
                p0.popPose()
            }
            var quien = nombreDe(d, BX.cg.q)
            if (quien != '') texto(g, quien, xx + iw - ancho(quien) - 8, yy + ih, 0xFFFFC080, true)
        }
        // GOLPES xN
        golpesDibujar(g, d, W, H)
        // ULTI: si no hay cinematica (lejos del ring), la imagen de siempre
        var tuc = t - BX.uc.desde
        if (!enCine && BX.uc.desde > 0 && tuc < 2600) {
            if (tuc < 450) caja(g, 0, 0, W, H, (Math.round(0xA0 * (1 - tuc / 450)) << 24) | 0xFFFFFF)
            var s = 1 + Math.max(0, 1 - tuc / 220) * 0.4
            var a = tuc > 2100 ? (2600 - tuc) / 500 : 1
            var uw = 200 * s, uh = 75 * s
            var uy = Math.floor(H * 0.36)
            if (!imagen(g, 'dinamicas:textures/gui/boxeo/ulti.png', cx - uw / 2, uy - uh / 2, uw, uh, 256, 96, a)) {
                textoG(g, '\u00A1ULTI!', cx, uy - 16, 4 * s, 0xFFFFA020)
            }
            var qn = nombreDe(d, BX.uc.q)
            if (qn != '') textoC(g, qn, cx, uy + uh / 2 + 2, 0xFFFFE0A0)
        }
        // ULTI bloqueada / fallada
        var tub = t - BX.ub.desde
        if (BX.ub.desde > 0 && tub < 1600) {
            var tipo = BX.ub.q % 10
            textoG(g, tipo == 1 ? '\u00A1ULTI BLOQUEADA!' : '\u00A1ULTI FALLADA!', cx, Math.floor(H * 0.28), 2, 0xFFFF6040)
        }
        // K.O.: "DOWN!" y la cuenta del arbitro bien grande (como el video)
        if (d.dn > 0) {
            var tko = t - BX.ko.desde
            if (d.fa == 2 && d.cnt >= 0) {
                var sd = 2.6 + Math.max(0, 1 - tko / 250) * 1.4
                var tdw = 'DOWN!'
                textoGI(g, tdw, cx - ancho(tdw) * sd / 2, 46, sd, (t % 500) < 250 ? 0xFFFFE04A : 0xFFFF8A1E, true)
                var tn = String(d.cnt)
                var fc = ((t - BX.cnt.en) % 1000) / 1000
                var sc = 6 - Math.min(1, fc * 4) * 1.6
                textoGI(g, tn, cx - ancho(tn) * sc / 2, Math.floor(H * 0.30), sc, conAlfa(0xFFFFFFFF, 1 - fc * 0.4), true)
                var quien = nombreDe(d, d.dn)
                if (quien != '') textoC(g, quien + ' intenta levantarse...', cx, Math.floor(H * 0.30) + 9 * sc + 6, 0xFFDDDDDD)
            } else {
                var ks = 1 + Math.max(0, 1 - tko / 250) * 0.8
                if (!imagen(g, 'dinamicas:textures/gui/boxeo/ko.png', cx - 48 * ks, 46, 96 * ks, 48 * ks, 128, 64, 1)) {
                    textoG(g, 'K.O.', cx, 52, 3, 0xFFFF4040)
                }
            }
        }
        // camara lenta de la ULTI del NECROID (costillas y el vuelo)
        var tl = t - BX.lento.desde
        if (BX.lento.desde > 0 && tl < 1300) {
            for (var o = 0; o < 2; o++) {
                var rl2 = ((tl / 4 + o * 90) % 180) + 10
                for (var q = 0; q < 36; q++) {
                    var an = (2 * PI_ * q) / 36
                    caja(g, cx + Math.cos(an) * rl2 * 1.6, H / 2 + Math.sin(an) * rl2, 2, 2, conAlfa(0xFFFF6070, 0.3 * (1 - rl2 / 190)))
                }
            }
        }
        // minijuego de la ULTI de ESCOPETA
        if (BX.mg != null) mgDibujar(g, W, H)
        // ---------- solo el boxeador ----------
        if (d.yo > 0 && !enCine) {
            var p = d.p[d.yo]
            var cyU = H - 40
            if (d.dn != d.yo) {
                ultiCirculo(g, cx, cyU, p.ul)
                habilidades(g, cx, cyU, p)
            }
            if (p.es == 1 && d.fa == 1 && d.dn == 0) timingDibujar(g, cx, cyU - 34)
            if (BX.hab != null) gatDibujar(g, cx, Math.floor(H * 0.64))
            if (p.cs == 1 && d.dn == 0) {
                if (!imagen(g, 'dinamicas:textures/gui/boxeo/cansado.png', cx - 62, cyU - 70, 124, 33, 208, 56, (t % 600) < 300 ? 1 : 0.6)) {
                    textoG(g, '\u00A1CANSADO!', cx, cyU - 62, 1.8, 0xFFB0B0B0)
                }
            }
            // en el suelo: ESPACIO para levantarse
            if (d.dn == d.yo) {
                if (p.ck > 0) {
                    if ((t % 500) < 300) textoG(g, '\u00A1ESPACIO!', cx, Math.floor(H / 2) + 24, 2.5, 0xFFFFFFFF)
                    textoG(g, String(p.ck), cx, Math.floor(H / 2) + 50, 2, 0xFFFFFF88)
                    textoC(g, 'Aprieta ESPACIO muchas veces para levantarte', cx, Math.floor(H / 2) + 70, 0xFFDDDDDD)
                } else if (p.ck < 0) {
                    textoG(g, 'No puedes levantarte', cx, Math.floor(H / 2) + 30, 1.5, 0xFFAAAAAA)
                }
            }
            // controles (a la derecha, debajo de los avisos, gris y chiquito)
            if (d.fa >= 1 && d.fa <= 4) controlesDibujar(g, W, H)
        }
        blend(false)
    }

    // ---- camara: el boxeador en tercera persona (de espaldas) y sin poder cambiarla ----
    var bxCamara = (d) => {
        if ($CameraType == null) return
        var opt = $Minecraft.getInstance().options
        var actual = String(opt.getCameraType())
        if (d != null && d.yo > 0) {
            if (BX.cam == null) BX.cam = actual
            if (actual != 'THIRD_PERSON_BACK') opt.setCameraType($CameraType.THIRD_PERSON_BACK)
        } else if (BX.cam != null) {
            var antes = BX.cam
            BX.cam = null
            if (actual != antes) {
                if (antes == 'FIRST_PERSON') opt.setCameraType($CameraType.FIRST_PERSON)
                else if (antes == 'THIRD_PERSON_FRONT') opt.setCameraType($CameraType.THIRD_PERSON_FRONT)
                else opt.setCameraType($CameraType.THIRD_PERSON_BACK)
            }
        }
    }

    // ---- F MANTENIDA: se le avisa al server al apretar (f1) y al soltar (f0) ----
    var bxCubrir = (d) => {
        var mc = $Minecraft.getInstance()
        var abajo = false
        if (d != null && d.yo > 0 && mc.screen == null) {
            if (TECLA.cubrir != null) {
                try {
                    abajo = TECLA.cubrir.isDown() == true
                } catch (e) {
                    bxLog('tecla F', e)
                    TECLA.cubrir = null
                }
            } else {
                abajo = BX.fRaw
            }
        }
        if (abajo != BX.fHeld) {
            BX.fHeld = abajo
            if (d != null && d.yo > 0) comando(abajo ? 'bxk f1' : 'bxk f0')
        }
    }

    // ---- avisar al server que este script esta (para el baile de victoria y el minijuego) ----
    var bxAvisarServer = () => {
        var mc = $Minecraft.getInstance()
        if (mc.level == null || mc.player == null) {
            BX.nivel = null
            return
        }
        var esto = String(mc.level)
        if (BX.nivel != esto) {
            BX.nivel = esto
            comando('dmcli 3')
        }
    }

    // ---- chat transparente (solo las letras): se pone UNA vez; si lo cambias en Opciones, se respeta ----
    var chatTransparente = () => {
        if (BX.cfg.chat) return
        BX.cfg.chat = true
        try {
            var opt = $Minecraft.getInstance().options
            var v = $Double != null ? $Double.valueOf(0.0) : 0.0
            opt.textBackgroundOpacity().set(v)
            opt.save()
            console.info('boxeo_hud.js: chat transparente (Opciones > Chat > Opacidad del fondo del texto = 0%)')
        } catch (e) {
            bxLog('chat transparente', e)
        }
        guardarCfg()
    }

    var esChat = (s) => {
        if (s == null) return false
        try {
            if ($ChatScreen != null && s instanceof $ChatScreen) return true
        } catch (e) { }
        try {
            return String(s.getClass().getName()).indexOf('ChatScreen') >= 0
        } catch (e) {
            return false
        }
    }
    var abrirSobreChat = () => {
        if ($ChatScreen == null) return false
        $Minecraft.getInstance().setScreen(new $ChatScreen(''))
        return true
    }

    // ---- la musica de fondo baja mientras dura la camara lenta y las ULTIS (despues vuelve como estaba) ----
    var musicaBaja = (si) => {
        if ($SS == null) return
        try {
            var inst = $Minecraft.getInstance().options.getSoundSourceOptionInstance($SS.RECORDS)
            if (si) {
                if (BX.vol == null) {
                    BX.vol = Number(inst.get())
                    var v = BX.vol * 0.25
                    inst.set($Double != null ? $Double.valueOf(v) : v)
                }
            } else if (BX.vol != null) {
                var v0 = BX.vol
                BX.vol = null
                inst.set($Double != null ? $Double.valueOf(v0) : v0)
            }
        } catch (e) {
            bxLog('musica baja', e)
            $SS = null
        }
    }

    // ---- camara del K.O.: enfoca al que cayo mientras intenta levantarse (da vueltas despacio) ----
    var KO = { mira: null }
    var koActivo = (d) => d != null && d.yo > 0 && d.dn > 0 && d.fa == 2 && !CINE.activo
    var koPreparar = (d, pt) => {
        if (!koActivo(d)) {
            KO.mira = null
            BX.koCam.activo = false
            return
        }
        var mc = $Minecraft.getInstance()
        var yo = mc.player
        var caido = entidad(nombreDe(d, d.dn))
        if (yo == null || caido == null) {
            KO.mira = null
            return
        }
        if (!BX.koCam.activo) {
            BX.koCam.activo = true
            BX.koCam.desde = ahora()
        }
        var tk = (ahora() - BX.koCam.desde) / 50
        var c = pos(caido, pt), me = pos(yo, pt)
        var base = d.dn == d.yo ? 160 : angulos(me, c).yaw + 30
        if (d.dn == d.yo && BX.koCam.yaw0 == null) BX.koCam.yaw0 = Number(yo.getYaw())
        if (d.dn != d.yo) BX.koCam.yaw0 = null
        var yc = (d.dn == d.yo ? BX.koCam.yaw0 + base : base) + tk * 0.8
        var pc = 22
        KO.mira = { x: c.x, y: c.y + 0.35, z: c.z }
        CINE.real = { y: Number(yo.getYaw()), x: Number(yo.getPitch()), yo: Number(yo.yRotO), xo: Number(yo.xRotO) }
        yo.setYaw(yc)
        yo.setPitch(pc)
        yo.yRotO = yc
        yo.xRotO = pc
    }

    // lo que no se ve mientras se pelea (la barra de abajo: vida, comida, inventario, experiencia, mira...)
    var OCULTAR_PELEA = { 'minecraft:hotbar': 1, 'minecraft:player_health': 1, 'minecraft:food_level': 1, 'minecraft:experience_bar': 1,
                          'minecraft:armor_level': 1, 'minecraft:air_level': 1, 'minecraft:mount_health': 1, 'minecraft:jump_bar': 1,
                          'minecraft:item_name': 1, 'minecraft:crosshair': 1, 'minecraft:potion_icons': 1 }

    ForgeEvents.onEvent('net.minecraftforge.client.event.RenderGuiEvent$Post', event => {
        try {
            var mc = $Minecraft.getInstance()
            if (mc.player == null) {
                BX.d = null
                BX.est = null
                BX.ev = null
                BX.gs = null
                BX.mg = null
                BX.hab = null
                BX.hola = ''
                CINE.activo = false
                bxCamara(null)
                grisPoner(false)
                musicaBaja(false)
                return
            }
            bxAvisarServer()
            chatTransparente()
            BX.est = estLeer()
            BX.d = bxLeer(BX.est)
            bxCamara(BX.d)
            // le aviso al server que tengo el script (una vez por pelea)
            if (BX.d != null && BX.d.yo > 0) {
                var clave = BX.d.r + ':' + BX.d.n1 + ':' + BX.d.n2
                if (BX.hola != clave) {
                    BX.hola = clave
                    comando('bxk hola')
                }
            } else {
                BX.hola = ''
            }
            var g = event.getGuiGraphics()
            // baile de victoria (aunque no haya boxeo)
            var w = winLeer()
            if (w != null && !mc.options.hideGui) {
                blend(true)
                winDibujar(g, w)
                blend(false)
            } else if (w == null) {
                BX.win.id = null
            }
            // la ruleta: cuando sube mi numero de giros empieza la animacion (normal, de la suerte o regalo)
            if (BX.est != null) {
                if (BX.gs == null) {
                    BX.gs = BX.est.gs
                } else if (BX.est.gs != BX.gs) {
                    BX.gs = BX.est.gs
                    if (BX.est.gs > 0) giroEmpezar(BX.est.es, BX.est.gk)
                }
            } else {
                BX.gs = null
                BX.ruleta = false
            }
            if (mc.screen == null) {
                BX.ruleta = false
                BX.rueda = false
            }
            if (BX.d != null) {
                bxAvisos(BX.d)
            } else {
                BX.ev = null
                CINE.activo = false
                BX.mg = null
                BX.hab = null
                BX.pf.activo = false
            }
            grisPoner(BX.d != null && pfActivo())
            musicaBaja(BX.d != null && (pfActivo() || cineActivo()))
            mgRevisar()
            gatRevisar()
            if (mc.options.hideGui) return
            if (BX.d != null) bxDibujar(g, BX.d)
            if (mc.screen == null && !cineActivo()) {
                blend(true)
                if (widgetVisible(BX.d, BX.est)) widgetDibujar(g, BX.est, false, -1, -1)
                if (esEspectador(BX.d, BX.est)) salirDibujar(g, false, -1, -1)
                blend(false)
            }
        } catch (e) {
            bxLog('dibujar', e)
        }
    })

    // cada cuadro, antes de dibujar: F mantenida, camara fijada, camara de cine y camara del K.O.
    ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$RenderTickEvent', event => {
        try {
            var fase = String(event.phase)
            if (fase == 'END') {
                cineDevolver()
                return
            }
            if (fase != 'START') return
            var t = ahora()
            var dt = BX.rtEn > 0 ? Math.min(0.1, Math.max(0.001, (t - BX.rtEn) / 1000)) : 0.016
            BX.rtEn = t
            var pt = Number(event.renderTickTime)
            if (isNaN(pt)) pt = 1
            bxCubrir(BX.d)
            if (cineActivo() && CINE.rol != 3) {
                cinePreparar(BX.d, pt)
            } else {
                if (cineActivo()) cinePreparar(BX.d, pt)
                fijar(BX.d, pt, dt)
                koPreparar(BX.d, pt)
            }
        } catch (e) {
            bxLog('camara fijada', e)
            try { cineDevolver() } catch (e2) { }
        }
    })

    // la camara mira donde toca (cinematica o K.O.) y se sacude con los impactos
    ForgeEvents.onEvent('net.minecraftforge.client.event.ViewportEvent$ComputeCameraAngles', event => {
        try {
            var t = ahora()
            var mira = null
            if (cineActivo() && CINE.mira != null) mira = CINE.mira
            else if (KO.mira != null && koActivo(BX.d)) mira = KO.mira
            if (mira != null) {
                var cp = event.getCamera().getPosition()
                var ang = angulos({ x: Number(cp.x()), y: Number(cp.y()), z: Number(cp.z()) }, mira)
                event.setYaw(ang.yaw)
                event.setPitch(ang.pitch)
            }
            if (BX.d != null && BX.imp > 0 && t - BX.imp < 380) {
                var amp = (BX.mg != null ? 1.2 : 3) * (1 - (t - BX.imp) / 380)
                event.setYaw(Number(event.getYaw()) + Math.sin(t * 0.11) * amp)
                event.setPitch(Number(event.getPitch()) + Math.cos(t * 0.17) * amp * 0.7)
                event.setRoll(Number(event.getRoll()) + Math.sin(t * 0.07) * amp * 0.8)
            }
        } catch (e) {
            bxLog('camara cine', e)
        }
    })

    // zoom en los impactos de la ULTI y en la camara lenta de la esquiva perfecta
    ForgeEvents.onEvent('net.minecraftforge.client.event.ViewportEvent$ComputeFov', event => {
        try {
            var f = 1
            if (cineActivo()) {
                var t = ahora() - BX.imp
                f = 0.94
                if (BX.imp > CINE.desde && t < 220) f = 0.84 + 0.1 * (t / 220)
            }
            if (BX.d != null && pfActivo()) f = f * 0.88
            if (f != 1) event.setFOV(Number(event.getFOV()) * f)
        } catch (e) {
            bxLog('zoom', e)
        }
    })

    // que se ve de la pantalla normal de Minecraft:
    //  - peleando: nada de la barra de abajo (vida, comida, inventario...) ni la mira
    //  - en la cinematica: casi nada
    //  - con el menu de estilos o la rueda de gestos: no se ve el chat
    //  - durante la cuenta del K.O.: no los titulos del server (se dibuja "DOWN!" y la cuenta grande)
    ForgeEvents.onEvent('net.minecraftforge.client.event.RenderGuiOverlayEvent$Pre', event => {
        try {
            var id = String(event.getOverlay().id())
            if (BX.ruleta || BX.rueda) {
                if (id == 'minecraft:chat_panel') {
                    event.setCanceled(true)
                    return
                }
            }
            var d = BX.d
            if (d != null && d.dn > 0 && d.fa == 2 && d.cnt >= 0 && id == 'minecraft:title_text') {
                event.setCanceled(true)
                return
            }
            if (peleando(d) && OCULTAR_PELEA[id] == 1) {
                event.setCanceled(true)
                return
            }
            if (!cineActivo()) return
            if (id == 'minecraft:chat_panel' || id == 'minecraft:title_text' || id == 'minecraft:subtitles') return
            event.setCanceled(true)
        } catch (e) {
            bxLog('ocultar', e)
        }
    })

    // teclas 1 2 3: habilidades (ESCOPETA: la 1 es el DOBLE GATILLO, y mientras corre la barra, el disparo)
    var habTecla = (n) => {
        var d = BX.d
        if (d == null || d.yo == 0) return
        var p = d.p[d.yo]
        var t = ahora()
        if (p.es == 4 && n == 1) {
            if (BX.hab != null && BX.hab.etapa > 0) {
                gatPulsar()
                return
            }
            if (d.fa != 1 || d.dn != 0 || cineActivo()) return
            if (p.cd[0] > 0 || p.cs == 1) return
            if (BX.hab != null || t - BX.habFin < 1500) return
            if (pfActivo() && BX.pf.q == d.yo && BX.pf.fin == 0) return
            comando('bxk h 1')
            gatEmpezar(1)
            return
        }
        if (d.fa != 1 || cineActivo()) return
        if (t - (BX.habEn || 0) < 250) return
        BX.habEn = t
        comando('bxk h ' + n)
    }
    // antes de que Minecraft lea las teclas: las 1 2 3 no cambian la barra (que no se ve) sino que son habilidades
    ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$ClientTickEvent', event => {
        try {
            if (String(event.phase) != 'START') return
            if (!peleando(BX.d)) return
            var mc = $Minecraft.getInstance()
            if (mc.player == null || mc.screen != null) return
            var ks = mc.options.keyHotbarSlots
            for (var i = 0; i < ks.length; i++) {
                while (ks[i].consumeClick()) {
                    if (i < 3) habTecla(i + 1)
                }
            }
        } catch (e) {
            bxLog('teclas 1 2 3', e)
        }
    })
    // la ruedita del raton no cambia la barra mientras pelea
    ForgeEvents.onEvent('net.minecraftforge.client.event.InputEvent$MouseScrollingEvent', event => {
        try {
            if (peleando(BX.d) && $Minecraft.getInstance().screen == null) event.setCanceled(true)
        } catch (e) {
            bxLog('rueda raton', e)
        }
    })

    // teclas: ULTI (R), ESTILOS (Y), GESTOS (B), flechas del minijuego y, si no hay teclas configurables, F
    ForgeEvents.onEvent('net.minecraftforge.client.event.InputEvent$Key', event => {
        try {
            var accion = Number(event.getAction())
            var k = Number(event.getKey())
            var mc = $Minecraft.getInstance()
            if (mc.player == null) return
            if (TECLA.cubrir == null && k == 70) {
                if (accion == 1 && mc.screen == null) BX.fRaw = true
                if (accion == 0) BX.fRaw = false
            }
            if (accion != 1 || mc.screen != null) return
            // minijuego de flechas
            if (BX.mg != null && !BX.mg.enviado) {
                if (mgTecla(k)) return
            }
            if (k == codigoTecla(TECLA.estilos, 89)) {
                // Y: el MENU DE ESTILOS (el chat queda escondido debajo)
                if (widgetVisible(BX.d, BX.est) && !cineActivo() && abrirSobreChat()) {
                    BX.ruleta = true
                    BX.rueda = false
                }
                return
            }
            if (k == codigoTecla(TECLA.gestos, 66)) {
                if (!peleando(BX.d) && !cineActivo() && abrirSobreChat()) {
                    BX.rueda = true
                    BX.ruleta = false
                }
                return
            }
            if (BX.d == null || BX.d.yo == 0) return
            if (k != codigoTecla(TECLA.ulti, 82)) return
            var t = ahora()
            if (t - BX.rEn < 250) return
            BX.rEn = t
            comando('bxk r')
        } catch (e) {
            bxLog('teclas', e)
        }
    })

    // ESPACIO: esquivar (no se salta) y, en el suelo, levantarse. Sin moverse durante el minijuego.
    ForgeEvents.onEvent('net.minecraftforge.client.event.MovementInputUpdateEvent', event => {
        try {
            var d = BX.d
            if (d == null || d.yo == 0 || d.fa == 5) {
                BX.salto = false
                return
            }
            var inp = event.getInput()
            var j = inp.jumping == true
            if (BX.mg != null && !BX.mg.enviado) {
                inp.up = false
                inp.down = false
                inp.left = false
                inp.right = false
                inp.forwardImpulse = 0
                inp.leftImpulse = 0
            }
            if (j && !BX.salto && $Minecraft.getInstance().screen == null) {
                var t = ahora()
                if (d.dn == d.yo) {
                    if (t - BX.spEn > 60) {
                        BX.spEn = t
                        comando('bxk sp')
                    }
                } else if (d.fa == 1 && !cineActivo() && BX.mg == null && t - BX.esqEn > 300) {
                    BX.esqEn = t
                    var dir = 'b'
                    if (inp.left == true) dir = 'l'
                    else if (inp.right == true) dir = 'r'
                    comando('bxk d ' + dir)
                }
            }
            BX.salto = j
            inp.jumping = false
        } catch (e) {
            bxLog('esquivar', e)
        }
    })

    // CLIC: los golpes ya no se pueden spamear (el ritmo de cada estilo) y RELAMPAGO: zona verde = PERFECTO
    ForgeEvents.onEvent('net.minecraftforge.client.event.InputEvent$InteractionKeyMappingTriggered', event => {
        try {
            if (!event.isAttack()) return
            var d = BX.d
            if (d == null || d.yo == 0 || d.fa != 1 || d.dn != 0) return
            var p = d.p[d.yo]
            var t = ahora()
            var ms = estilo(p.es).ritmo * 50 - 30
            if (t - BX.golEn < ms) {
                event.setCanceled(true)
                try { event.setSwingHand(false) } catch (e2) { }
                return
            }
            BX.golEn = t
            if (p.es != 1) return
            if (timingVerde(t) && t - BX.tmEnv > 150) {
                BX.tmEnv = t
                comando('bxk t')
            }
        } catch (e) {
            bxLog('timing', e)
        }
    })

    // con el menu de estilos / la rueda de gestos abiertos, el chat no se dibuja ni se escribe en el
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$Render$Pre', event => {
        try {
            if ((BX.ruleta || BX.rueda) && esChat(event.getScreen())) event.setCanceled(true)
        } catch (e) {
            bxLog('ocultar chat', e)
        }
    })
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$KeyPressed$Pre', event => {
        try {
            if (!(BX.ruleta || BX.rueda) || !esChat(event.getScreen())) return
            if (Number(event.getKeyCode()) == 256) return   // ESC cierra
            event.setCanceled(true)
        } catch (e) {
            bxLog('teclas menu', e)
        }
    })
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$CharacterTyped$Pre', event => {
        try {
            if ((BX.ruleta || BX.rueda) && esChat(event.getScreen())) event.setCanceled(true)
        } catch (e) {
            bxLog('letras menu', e)
        }
    })

    // con el chat abierto: mini menu ESTILOS (con el raton), la ruleta, la rueda de gestos y SALIR DE ESPECTADOR
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$Render$Post', event => {
        try {
            if (!esChat(event.getScreen()) || cineActivo()) return
            var g = event.getGuiGraphics()
            var mx = Number(event.getMouseX()), my = Number(event.getMouseY())
            blend(true)
            if (BX.rueda) {
                ruedaDibujar(g, mx, my)
            } else if (BX.ruleta && BX.est != null) {
                ruletaDibujar(g, BX.d, BX.est, mx, my)
            } else {
                if (widgetVisible(BX.d, BX.est)) widgetDibujar(g, BX.est, true, mx, my)
                if (esEspectador(BX.d, BX.est)) salirDibujar(g, true, mx, my)
            }
            blend(false)
        } catch (e) {
            bxLog('ruleta', e)
        }
    })
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre', event => {
        try {
            if (!esChat(event.getScreen()) || cineActivo()) return
            if (Number(event.getButton()) != 0) return
            var x = Number(event.getMouseX()), y = Number(event.getMouseY())
            var mc = $Minecraft.getInstance()
            if (BX.rueda) {
                event.setCanceled(true)
                ruedaClic(x, y)
                if (BX.rueda) {
                    BX.rueda = false
                    mc.setScreen(null)
                }
                return
            }
            if (BX.ruleta && BX.est != null) {
                event.setCanceled(true)
                ruletaClic(BX.d, BX.est, x, y)
                return
            }
            if (widgetVisible(BX.d, BX.est)) {
                var c = widgetCaja()
                if (dentro(x, y, c.x, c.y, c.w, c.h)) {
                    BX.ruleta = true
                    event.setCanceled(true)
                    return
                }
            }
            if (esEspectador(BX.d, BX.est)) {
                var b = salirCaja()
                if (dentro(x, y, b.x, b.y, b.w, b.h)) {
                    event.setCanceled(true)
                    comando('bxsalir')
                    mc.setScreen(null)
                }
            }
        } catch (e) {
            bxLog('clic ruleta', e)
        }
    })

    // mientras pelea no se abre el inventario
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$Opening', event => {
        try {
            if (!peleando(BX.d)) return
            var s = event.getNewScreen()
            if (s == null) return
            var nombre = String(s.getClass().getName())
            if (nombre.indexOf('InventoryScreen') >= 0) event.setCanceled(true)
        } catch (e) {
            bxLog('inventario', e)
        }
    })

    console.info('boxeo_hud.js: HUD del boxeo v5 cargado (10 estilos, giros de la suerte, botones 1 2 3, sin barra de abajo, camara del K.O., esquiva perfecta 2 s)')
}

if (Platform.isClientEnvironment()) {
    try {
        boxeoHudIniciar()
    } catch (e) {
        console.error('boxeo_hud.js: no se pudo cargar el HUD del boxeo: ' + e)
    }
}
