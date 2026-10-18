// ==========================================================
// MINI MENU DE MUSICA (JUEGO DE CADA JUGADOR)   KubeJS 6 - Forge 1.20.1   v6
//
//  Este archivo va en el JUEGO de cada jugador:  <instancia>/kubejs/startup_scripts/
//  (en el servidor no hace nada). Despues de copiarlo hay que CERRAR el juego del todo
//  y volver a abrirlo: F3+T o cambiar de paquete de recursos NO lo carga.
//
//  - Abajo a la derecha SIEMPRE esta el cuadro de la musica:
//        \u266A M\u00FAsica 60%                    [\u25BC]
//        \u2501\u2501\u2501\u2501\u25CF\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501          [\u23ED] [||]
//        Veh\u00EDculos 35%
//        \u2501\u2501\u25CF\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
//    No se puede cerrar: la flechita [\u25BC] solo lo MINIMIZA (queda una pesta\u00F1ita "\u266A \u25B2").
//  - Pulsa T (chat abierto = raton libre) y:
//      \u00B7 click o arrastra en la LINEA de musica   -> subir / bajar el volumen de la musica
//      \u00B7 [\u23ED]                                      -> SIGUIENTE cancion (solo para ti)
//      \u00B7 [\u21BB]                                      -> REPETIR: la cancion que te gusta se repite
//  - Debajo del titulo sale el NOMBRE de la cancion que suena (en blanco) con su etiqueta:
//    "(con copy)" en VERDE = cancion con derechos de autor (si grabas, pausala o pasa a la siguiente),
//    "(sin copy)" en celeste = libre para grabar.
//      \u00B7 [||]                                     -> pausa (solo para ti)   [\u25B6] -> vuelve a sonar
//      \u00B7 LINEA de Vehiculos                       -> volumen de los autos (Immersive Vehicles)
//      \u00B7 rueda del raton encima de una linea      -> +5% / -5%
//      \u00B7 [\u25BC]                                      -> minimizar      pesta\u00F1ita [\u266A \u25B2] -> abrir
//  - La musica de las dinamicas suena en "Discos y bloques musicales": la linea cambia ese
//    volumen y se guarda en las opciones del juego.
//  - Vehiculos: cambia el volumen de sonido del mod Immersive Vehicles (MTS) y se guarda en
//    config/mtsconfigclient.json. La primera vez se pone en 35% (los autos tapaban la musica).
//    Si el mod no esta, esa linea no sale.
//  - MARCADOR DE LA DERECHA: se dibuja igual que el de Minecraft pero SIN los numeros rojos.
//    Si algo falla, vuelve a salir el normal (con numeros).
//  - Si no sale nada, mira logs/kubejs/startup.log: tiene que decir "mini menu de musica cargado".
//
//  v3: todo va dentro de una funcion y solo con "var". El Rhino de KubeJS no acepta "const"
//      dentro de un "if" (daba "TypeError: redeclaration of var $Minecraft" al abrir el juego).
//  v4: los textos se dibujan con drawWordWrap (solo hay UNA version). Con drawString KubeJS no
//      sabia cual de sus versiones usar ("is ambiguous") y solo salia el cuadro vacio.
//  v5: boton SIGUIENTE, volumen de vehiculos y marcador sin numeros.
//  v6: nombre de la cancion (con copy en verde / sin copy en celeste) y boton REPETIR.
//  v7: botones TECLAS DE AUTOS (menu de teclas de Immersive Vehicles) y TECLAS (controles de Minecraft).
//      Arreglado el marcador sin numeros (KubeJS llama getUsername a getScoreboardName) y si el server
//      pone una cancion que NO esta en tu paquete, sale un aviso rojo y pasa sola a la siguiente.
// ==========================================================

function musicaVolumenIniciar() {
    var $Minecraft = Java.loadClass('net.minecraft.client.Minecraft')
    var $SoundSource = Java.loadClass('net.minecraft.sounds.SoundSource')
    var $ChatScreen = Java.loadClass('net.minecraft.client.gui.screens.ChatScreen')
    var $Double = Java.loadClass('java.lang.Double')
    var $Float = Java.loadClass('java.lang.Float')
    var $Component = Java.loadClass('net.minecraft.network.chat.Component')
    var $PlayerTeam = Java.loadClass('net.minecraft.world.scores.PlayerTeam')
    var $Language = Java.loadClass('net.minecraft.locale.Language')

    var MV_ARCHIVO = 'kubejs/musica_volumen.json'
    var MV = {
        min: false,           // minimizado
        arrastrando: '',      // '' | 'mus' | 'veh'
        ultimo: 0.5,          // a donde vuelve al quitar la pausa
        antes: -1,            // volumen del cuadro anterior (para saber si se quito la pausa)
        pedir: false,         // pedir al servidor que vuelva a poner la cancion
        pedidoEn: 0,
        sigEn: 0,             // ultimo SIGUIENTE (para no mandar dos seguidos)
        mtsIni: false,        // ya se puso el volumen de vehiculos inicial (35%)
        repetir: false,       // REPETIR la cancion
        nivel: null,          // mundo actual (al cambiar se le vuelve a avisar al server)
        cancion: null,        // { id, inst, desde } la cancion de las dinamicas que suena
        falta: null,          // { id, desde, saltada } cancion que el server pone pero NO esta en tu paquete
        saltosFalta: [],      // cuando se salto sola (para no saltar sin parar si no hay paquete)
        errores: 0,
        erroresLado: 0
    }

    var mvLog = (donde, e) => {
        if (MV.errores < 8) console.error('musica_volumen.js (' + donde + '): ' + e)
        MV.errores++
    }

    // ---- recordar si estaba minimizado ----
    try {
        var d = JsonIO.read(MV_ARCHIVO)
        if (d != null) {
            if (String(d.get('min')) == 'true') MV.min = true
            if (String(d.get('mtsIni')) == 'true') MV.mtsIni = true
            if (String(d.get('repetir')) == 'true') MV.repetir = true
            var u = Number(d.get('ultimo'))
            if (u > 0 && u <= 1) MV.ultimo = u
        }
    } catch (e) { }
    var mvGuardarEstado = () => {
        try {
            JsonIO.write(MV_ARCHIVO, { min: MV.min, ultimo: MV.ultimo, mtsIni: MV.mtsIni, repetir: MV.repetir })
        } catch (e) {
            mvLog('guardar', e)
        }
    }

    var mvLimitar = (v) => {
        if (!(v >= 0)) v = 0
        if (v > 1) v = 1
        return Math.round(v * 100) / 100
    }

    // ---- volumen de la musica (categoria "Discos y bloques musicales") ----
    var mvOpcion = () => $Minecraft.getInstance().options.getSoundSourceOptionInstance($SoundSource.valueOf('RECORDS'))
    var mvVol = () => {
        try {
            return Number(mvOpcion().get())
        } catch (e) {
            mvLog('leer volumen', e)
            return 1
        }
    }
    var mvPoner = (v, guardar) => {
        v = mvLimitar(v)
        try {
            mvOpcion().set($Double.valueOf(v))
            if (guardar) $Minecraft.getInstance().options.save()
        } catch (e) {
            mvLog('cambiar volumen', e)
        }
    }
    var mvPausa = () => {
        var v = mvVol()
        if (v > 0) {
            MV.ultimo = v
            mvPoner(0, true)
        } else {
            mvPoner(MV.ultimo > 0.05 ? MV.ultimo : 0.5, true)
        }
        mvGuardarEstado()
    }

    // ---- mi nombre (KubeJS le cambia el nombre a getScoreboardName: se llama getUsername) ----
    var mvMiNombre = () => {
        var mc = $Minecraft.getInstance()
        try {
            if (mc.player != null) return String(mc.player.getUsername())
        } catch (e) { }
        try {
            return String(mc.getUser().getName())
        } catch (e) {
            mvLog('mi nombre', e)
        }
        return ''
    }

    // ---- menus de teclas ----
    // TECLAS DE AUTOS: el menu de configuracion de Immersive Vehicles (alli cada uno pone sus teclas
    // para manejar: acelerar, frenar, cambios, luces...). Normalmente se abre con P, pero P tambien
    // abre los shaders (Oculus): por eso este boton lo abre directo.
    var mvTeclasAutos = () => {
        try {
            var $Cfg = Java.loadClass('minecrafttransportsimulator.guis.instances.GUIConfig')
            new $Cfg()
        } catch (e) {
            mvLog('teclas autos', e)
        }
    }
    // TECLAS: los controles de Minecraft (ahi estan las del boxeo: "Din\u00E1micas" -> ULTI y cubrirse)
    var mvTeclasMinecraft = () => {
        try {
            var mc = $Minecraft.getInstance()
            var $KB = Java.loadClass('net.minecraft.client.gui.screens.controls.KeyBindsScreen')
            mc.setScreen(new $KB(null, mc.options))
        } catch (e) {
            mvLog('teclas', e)
        }
    }

    // ---- comandos al servidor ----
    var mvComando = (c) => {
        try {
            var con = $Minecraft.getInstance().getConnection()
            if (con != null) con.sendCommand(c)
        } catch (e) {
            mvLog('comando ' + c, e)
        }
    }
    var mvSiguiente = () => {
        var ahora = Date.now()
        if (ahora - MV.sigEn < 700) return
        MV.sigEn = ahora
        mvComando('mimusica sig')
    }
    var mvRepetir = () => {
        MV.repetir = !MV.repetir
        mvComando('mimusica repetir ' + (MV.repetir ? 'on' : 'off'))
        mvGuardarEstado()
    }
    // al entrar al server (o cambiar de mundo) se le recuerda si tienes REPETIR
    var mvSync = () => {
        var mc = $Minecraft.getInstance()
        if (mc.level == null) {
            MV.nivel = null
            return
        }
        var esto = String(mc.level)
        if (MV.nivel != esto) {
            MV.nivel = esto
            if (MV.repetir) mvComando('mimusica repetir on')
        }
    }

    // nombre en blanco + etiqueta de color: "(con copy)" en VERDE, "(sin copy)" en celeste
    var mvNombre = (g, tit, x, y) => {
        var etq = ''
        var ecol = 0xFFFFFFFF
        if (tit.indexOf(' (con copy)') >= 0) { etq = ' (con copy)'; ecol = 0xFF55FF55 }
        if (tit.indexOf(' (sin copy)') >= 0) { etq = ' (sin copy)'; ecol = 0xFF55FFFF }
        if (etq == '') {
            mvTexto(g, tit, x, y, tit.indexOf('Te falta') >= 0 ? 0xFFFF5555 : 0xFFFFFFFF)
            return
        }
        var nom = tit.substring(0, tit.lastIndexOf(etq))
        mvTexto(g, nom, x, y, 0xFFFFFFFF)
        mvTexto(g, etq.substring(1), x + mvAncho(nom + ' '), y, ecol)
    }
    // ---- nombre de la cancion que suena (titulos en el paquete de recursos) ----
    var mvTitulo = () => {
        if (MV.falta != null && Date.now() - MV.falta.desde < 9000) {
            return '\u00A1Te falta la canci\u00F3n "' + MV.falta.id + '"! Pon el paquete de Din\u00E1micas NUEVO (v11)'
        }
        var cn = MV.cancion
        if (cn == null) return ''
        try {
            var activa = $Minecraft.getInstance().getSoundManager().isActive(cn.inst)
            if (!activa && Date.now() - cn.desde > 2000) {
                MV.cancion = null
                return ''
            }
        } catch (e) {
            mvLog('cancion activa', e)
        }
        var clave = 'dinamicas.titulo.' + cn.id
        var t = clave
        try {
            t = String($Language.getInstance().getOrDefault(clave))
        } catch (e) {
            mvLog('titulo', e)
        }
        if (t == clave) t = cn.id
        return t
    }

    // ---- volumen de VEHICULOS (Immersive Vehicles / MTS) ----
    //  minecrafttransportsimulator.systems.ConfigSystem.client.controlSettings.soundVolume.value
    //  es un Float (el mod lo usa como (Float) al poner el volumen de cada sonido).
    var MTS = { probado: false, cls: null }
    var mtsEntrada = () => {
        if (!MTS.probado) {
            MTS.probado = true
            try {
                MTS.cls = Java.loadClass('minecrafttransportsimulator.systems.ConfigSystem')
            } catch (e) {
                MTS.cls = null
                console.info('musica_volumen.js: Immersive Vehicles no esta (sin linea de vehiculos)')
            }
        }
        if (MTS.cls == null) return null
        try {
            var cl = MTS.cls.client
            if (cl == null) return null
            var cs = cl.controlSettings
            if (cs == null) return null
            return cs.soundVolume
        } catch (e) {
            mvLog('vehiculos', e)
            return null
        }
    }
    var mtsVol = () => {
        var en = mtsEntrada()
        if (en == null) return -1
        try {
            var v = Number(en.value)
            if (isNaN(v)) return -1
            if (v > 1) v = 1
            return v
        } catch (e) {
            mvLog('leer vehiculos', e)
            return -1
        }
    }
    var mtsPoner = (v, guardar) => {
        var en = mtsEntrada()
        if (en == null) return
        v = mvLimitar(v)
        try {
            // tiene que ser un Float de Java (un numero de JS seria Double y el mod fallaria)
            en.value = $Float.valueOf(v)
            if (guardar) MTS.cls.saveToDisk()
        } catch (e) {
            mvLog('cambiar vehiculos', e)
        }
    }
    // la primera vez: vehiculos al 35%
    var mtsInicial = () => {
        if (MV.mtsIni) return
        if (mtsEntrada() == null) return
        MV.mtsIni = true
        if (mtsVol() > 0.35) mtsPoner(0.35, true)
        mvGuardarEstado()
    }

    var mvEsChat = (s) => {
        if (s == null) return false
        try {
            if (s instanceof $ChatScreen) return true
        } catch (e) { }
        try {
            return String(s.getClass().getName()).indexOf('ChatScreen') >= 0
        } catch (e) {
            return false
        }
    }

    // ---- medidas (coordenadas de la interfaz): esquina de abajo a la derecha, encima de la
    //      barra donde se escribe en el chat ----
    var mvCaja = () => {
        var win = $Minecraft.getInstance().getWindow()
        var w = win.getGuiScaledWidth()
        var h = win.getGuiScaledHeight()
        var c = {}
        c.veh = mtsVol() >= 0
        c.pw = 150
        c.ph = (c.veh ? 62 : 40) + 16
        c.px = w - c.pw - 3
        c.py = h - c.ph - 16
        // nombre de la cancion
        c.cy = c.py + 13
        // linea de musica
        c.lx1 = c.px + 7
        c.lx2 = c.px + c.pw - 62
        c.ly = c.py + 30
        // boton repetir
        c.rx = c.px + c.pw - 56
        c.ry = c.py + 24
        // boton siguiente
        c.sx = c.px + c.pw - 41
        c.sy = c.py + 24
        // boton pausa
        c.btx = c.px + c.pw - 26
        c.bty = c.py + 24
        c.btw = 13
        c.bth = 13
        // linea de vehiculos
        c.vx1 = c.px + 7
        c.vx2 = c.px + c.pw - 12
        c.vy = c.py + 54
        // fila de abajo: TECLAS DE AUTOS (solo con Immersive Vehicles) y TECLAS (controles de Minecraft)
        c.ky = c.py + c.ph - 15
        c.kh = 12
        c.ax = c.px + 4
        c.aw = 86
        c.kx = c.px + c.pw - 4 - 52
        c.kw = 52
        // flechita minimizar (arriba a la derecha)
        c.mx = c.px + c.pw - 13
        c.my = c.py + 1
        c.mw = 12
        c.mh = 11
        // pesta\u00F1ita cuando esta minimizado
        c.tw = 28
        c.th = 13
        c.tx = w - c.tw - 3
        c.ty = h - c.th - 16
        return c
    }
    var dentro = (x, y, x1, y1, w, h) => x >= x1 && x < x1 + w && y >= y1 && y < y1 + h
    var col = (n) => n | 0
    var mvFont = () => $Minecraft.getInstance().font

    // texto: drawWordWrap(Font, FormattedText, x, y, ancho, color) es el unico metodo de texto
    // sin varias versiones (drawString tiene version texto y version Component y KubeJS no
    // sabe elegir). sombra = se dibuja dos veces: sombra oscura y encima el color.
    var mvTextoC = (g, comp, x, y, c, sombra) => {
        var xi = Math.floor(x)
        var yi = Math.floor(y)
        if (sombra) g.drawWordWrap(mvFont(), comp, xi + 1, yi + 1, 400, col(0xFF202020))
        g.drawWordWrap(mvFont(), comp, xi, yi, 400, col(c))
    }
    var mvTexto = (g, t, x, y, c) => {
        try {
            mvTextoC(g, $Component.literal(String(t)), x, y, c, true)
        } catch (e) {
            mvLog('texto', e)
        }
    }
    // ancho: width con texto normal (la unica version que acepta un texto)
    var mvAncho = (t) => {
        try {
            return Number(mvFont().width(String(t)))
        } catch (e) {
            mvLog('ancho', e)
            return 6 * String(t).length
        }
    }
    var mvCentrado = (g, t, x, y, w, c) => {
        mvTexto(g, t, x + (w - mvAncho(t)) / 2, y, c)
    }

    // si se quito la pausa (de 0 a mas), se pide al servidor que vuelva a poner la cancion
    var mvFaltaVigilar = () => {
        var f = MV.falta
        if (f == null || f.saltada) return
        var ahora = Date.now()
        if (ahora - f.desde < 1500) return
        MV.saltosFalta = MV.saltosFalta.filter(t => ahora - t < 60000)
        f.saltada = true
        if (MV.saltosFalta.length >= 5) return
        MV.saltosFalta.push(ahora)
        mvComando('mimusica sig')
    }
    var mvVigilar = () => {
        try {
            mvFaltaVigilar()
        } catch (e) {
            mvLog('falta', e)
        }
        var v = mvVol()
        if (MV.antes >= 0 && MV.antes <= 0 && v > 0) MV.pedir = true
        if (v > 0) MV.ultimo = v
        MV.antes = v
        if (MV.pedir && MV.arrastrando == '') {
            var ahora = Date.now()
            if (ahora - MV.pedidoEn > 1500) {
                MV.pedir = false
                MV.pedidoEn = ahora
                mvComando('mimusica on')
            }
        }
    }

    // ---- dibujo ----
    var mvLinea = (g, x1, x2, y, v, colorLleno, hover) => {
        g.fill(x1, y - 1, x2, y + 1, col(0xFF555555))
        var kx = Math.round(x1 + (x2 - x1) * v)
        g.fill(x1, y - 1, kx, y + 1, col(colorLleno))
        g.fill(kx - 2, y - 4, kx + 2, y + 4, col(hover ? 0xFFFFFF55 : 0xFFFFFFFF))
    }
    var mvBoton = (g, x, y, w, h, t, hover, ct) => {
        g.fill(x, y, x + w, y + h, col(hover ? 0xFF4A5A70 : 0xFF2A3240))
        mvCentrado(g, t, x, y + 3, w, ct)
    }

    // activo = chat abierto (se puede usar con el raton); si no, se ve un poco transparente
    var mvDibujar = (g, activo, mx, my) => {
        var c = mvCaja()
        var v = mvVol()
        var pausa = v <= 0
        if (MV.min) {
            var hv = activo && dentro(mx, my, c.tx, c.ty, c.tw, c.th)
            g.fill(c.tx, c.ty, c.tx + c.tw, c.ty + c.th, col(hv ? 0xE0405070 : (activo ? 0xC0101018 : 0x80000000)))
            g.fill(c.tx, c.ty, c.tx + c.tw, c.ty + 1, col(pausa ? 0xFFFFAA00 : 0xFF55FF55))
            mvCentrado(g, '\u266A \u25B2', c.tx, c.ty + 3, c.tw, pausa ? 0xFFFFAA00 : 0xFFFFFFFF)
            return
        }
        // fondo
        g.fill(c.px, c.py, c.px + c.pw, c.py + c.ph, col(activo ? 0xD0101018 : 0x80000000))
        g.fill(c.px, c.py, c.px + c.pw, c.py + 1, col(pausa ? 0xFFFFAA00 : 0xFF55FF55))
        // titulo
        mvTexto(g, '\u266A M\u00FAsica  ' + (pausa ? 'PAUSA' : Math.round(v * 100) + '%'), c.px + 4, c.py + 3, pausa ? 0xFFFFAA00 : 0xFFFFFFFF)
        // flechita minimizar
        var hm = activo && dentro(mx, my, c.mx, c.my, c.mw, c.mh)
        if (hm) g.fill(c.mx, c.my, c.mx + c.mw, c.my + c.mh, col(0xC0405070))
        mvCentrado(g, '\u25BC', c.mx, c.my + 2, c.mw, hm ? 0xFFFFFF55 : 0xFFAAAAAA)
        // nombre de la cancion (si es largo, se desliza)
        var tit = mvTitulo()
        if (tit == '') tit = '\u2014'
        var aw = c.pw - 8
        var tw = mvAncho(tit)
        if (tw <= aw) {
            mvNombre(g, tit, c.px + 4, c.cy)
        } else {
            var desp = Math.floor(Date.now() / 50) % (tw + 30)
            try {
                g.enableScissor(c.px + 4, c.cy - 1, c.px + 4 + aw, c.cy + 10)
                mvNombre(g, tit, c.px + 4 - desp, c.cy)
                mvNombre(g, tit, c.px + 4 - desp + tw + 30, c.cy)
                g.disableScissor()
            } catch (e) {
                mvLog('nombre', e)
            }
        }
        // linea de musica
        var hk = activo && (MV.arrastrando == 'mus' || (MV.arrastrando == '' && dentro(mx, my, c.lx1 - 4, c.ly - 6, c.lx2 - c.lx1 + 8, 12)))
        mvLinea(g, c.lx1, c.lx2, c.ly, v, pausa ? 0xFFFFAA00 : 0xFF55FF55, hk)
        // boton repetir (verde = encendido)
        var hr = activo && dentro(mx, my, c.rx, c.ry, c.btw, c.bth)
        mvBoton(g, c.rx, c.ry, c.btw, c.bth, '\u21BB', hr, MV.repetir ? 0xFF55FF55 : (hr ? 0xFFFFFF55 : 0xFF888888))
        // boton siguiente
        var hs = activo && dentro(mx, my, c.sx, c.sy, c.btw, c.bth)
        mvBoton(g, c.sx, c.sy, c.btw, c.bth, '\u23ED', hs, hs ? 0xFFFFFF55 : 0xFFFFFFFF)
        // boton pausa / seguir
        var hb = activo && dentro(mx, my, c.btx, c.bty, c.btw, c.bth)
        mvBoton(g, c.btx, c.bty, c.btw, c.bth, pausa ? '\u25B6' : '||', hb, pausa ? 0xFF55FF55 : 0xFFFFFFFF)
        var htk = activo && dentro(mx, my, c.kx, c.ky, c.kw, c.kh)
        mvBoton(g, c.kx, c.ky, c.kw, c.kh, 'TECLAS', htk, htk ? 0xFFFFFF55 : 0xFFDDDDDD)
        // vehiculos
        if (c.veh) {
            var vv = mtsVol()
            if (vv < 0) vv = 0
            mvTexto(g, 'Veh\u00EDculos  ' + (vv <= 0 ? 'SIN SONIDO' : Math.round(vv * 100) + '%'), c.px + 4, c.py + 40, vv <= 0 ? 0xFFFFAA00 : 0xFFCCCCCC)
            var hvv = activo && (MV.arrastrando == 'veh' || (MV.arrastrando == '' && dentro(mx, my, c.vx1 - 4, c.vy - 6, c.vx2 - c.vx1 + 8, 12)))
            mvLinea(g, c.vx1, c.vx2, c.vy, vv, 0xFF55AAFF, hvv)
            var hta = activo && dentro(mx, my, c.ax, c.ky, c.aw, c.kh)
            mvBoton(g, c.ax, c.ky, c.aw, c.kh, 'TECLAS DE AUTOS', hta, hta ? 0xFFFFFF55 : 0xFF99CCFF)
        }
        // ayuda (solo con el chat abierto)
        if (activo) {
            var ayuda = 'M\u00FAsica (solo para ti)'
            if (hs) ayuda = '\u23ED Siguiente canci\u00F3n'
            if (hr) ayuda = MV.repetir ? '\u21BB Repetir: S\u00CD (clic = NO)' : '\u21BB Repetir esta canci\u00F3n'
            mvTexto(g, ayuda, c.px + 2, c.py - 10, 0xFFAAAAAA)
        }
    }

    var mvDesdeX = (x, c) => {
        mvPoner((x - c.lx1) / (c.lx2 - c.lx1), false)
    }
    var mtsDesdeX = (x, c) => {
        mtsPoner((x - c.vx1) / (c.vx2 - c.vx1), false)
    }

    // ---- MARCADOR DE LA DERECHA SIN NUMEROS ----
    // Es el mismo dibujo que hace Minecraft (Gui.displayScoreboardSidebar) pero sin la columna
    // de numeros rojos. Devuelve true si lo dibujo (entonces se cancela el de Minecraft).
    var mvAnchoTitulo = (comp) => {
        var s = String(comp.getString())
        var w = mvAncho(s)
        try {
            if (comp.getStyle().isBold()) w += s.length
        } catch (e) { }
        return w
    }
    var mvAnchoNombre = (eq, dueno) => {
        var s = dueno
        if (eq != null) {
            try {
                s = String(eq.getPlayerPrefix().getString()) + dueno + String(eq.getPlayerSuffix().getString())
            } catch (e) { }
        }
        return mvAncho(s)
    }
    var mvLado = (g) => {
        var mc = $Minecraft.getInstance()
        if (mc.level == null || mc.player == null) return false
        var sb = mc.level.getScoreboard()
        var obj = null
        var miEq = sb.getPlayersTeam(mvMiNombre())
        if (miEq != null) {
            var cid = Number(miEq.getColor().getId())
            if (cid >= 0) obj = sb.getDisplayObjective(3 + cid)
        }
        if (obj == null) obj = sb.getDisplayObjective(1)
        if (obj == null) return true
        // (getPlayerScores tiene 2 versiones y KubeJS no sabria elegir: se usan metodos unicos)
        var lista = []
        var it = sb.getTrackedPlayers().iterator()
        while (it.hasNext()) {
            var dueno = String(it.next())
            if (dueno.length < 1 || dueno.charAt(0) == '#') continue
            if (!sb.hasPlayerScore(dueno, obj)) continue
            lista.push({ d: dueno, p: Number(sb.getOrCreatePlayerScore(dueno, obj).getScore()) })
        }
        // como Minecraft: de menor a mayor (empate: nombre al reves) y se dibuja de abajo hacia arriba
        lista.sort((a, b) => {
            if (a.p != b.p) return a.p - b.p
            var x = b.d.toLowerCase()
            var y = a.d.toLowerCase()
            return x < y ? -1 : (x > y ? 1 : 0)
        })
        if (lista.length > 15) lista = lista.slice(lista.length - 15)
        var titulo = obj.getDisplayName()
        var tw = mvAnchoTitulo(titulo)
        var j = tw
        var filas = []
        for (var k = 0; k < lista.length; k++) {
            var eq = sb.getPlayersTeam(lista[k].d)
            filas.push($PlayerTeam.formatNameForTeam(eq, $Component.literal(lista[k].d)))
            var wn = mvAnchoNombre(eq, lista[k].d)
            if (wn > j) j = wn
        }
        var win = mc.getWindow()
        var sw = Number(win.getGuiScaledWidth())
        var sh = Number(win.getGuiScaledHeight())
        var i2 = filas.length * 9
        var j2 = Math.floor(sh / 2) + Math.floor(i2 / 3)
        var l2 = sw - j - 3
        var l1 = sw - 3 + 2
        for (var l = 1; l <= filas.length; l++) {
            var k1 = j2 - l * 9
            g.fill(l2 - 2, k1, l1, k1 + 9, col(0x4C000000))
            mvTextoC(g, filas[l - 1], l2, k1, 0xFFFFFFFF, false)
            if (l == filas.length) {
                g.fill(l2 - 2, k1 - 10, l1, k1 - 1, col(0x66000000))
                g.fill(l2 - 2, k1 - 1, l1, k1, col(0x4C000000))
                mvTextoC(g, titulo, l2 + Math.floor(j / 2) - Math.floor(tw / 2), k1 - 9, 0xFFFFFFFF, false)
            }
        }
        return true
    }

    ForgeEvents.onEvent('net.minecraftforge.client.event.RenderGuiOverlayEvent$Pre', event => {
        if (MV.erroresLado >= 3) return
        try {
            if (String(event.getOverlay().id()) != 'minecraft:scoreboard') return
        } catch (e) {
            MV.erroresLado = 3
            mvLog('marcador id', e)
            return
        }
        try {
            if (mvLado(event.getGuiGraphics())) event.setCanceled(true)
        } catch (e) {
            // si falla 3 veces se deja el marcador normal de Minecraft
            MV.erroresLado++
            mvLog('marcador', e)
        }
    })

    // ---- siempre (en el juego, sin pantallas abiertas) ----
    ForgeEvents.onEvent('net.minecraftforge.client.event.RenderGuiEvent$Post', event => {
        try {
            mvVigilar()
            mtsInicial()
            mvSync()
            var mc = $Minecraft.getInstance()
            if (mc.player == null) return
            if (mc.options.hideGui) return
            if (mc.screen != null) {
                if (!mvEsChat(mc.screen)) MV.arrastrando = ''
                return
            }
            MV.arrastrando = ''
            mvDibujar(event.getGuiGraphics(), false, -1, -1)
        } catch (e) {
            mvLog('dibujar', e)
        }
    })

    // ---- con el chat abierto (T): se puede usar con el raton ----
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$Render$Post', event => {
        try {
            if (!mvEsChat(event.getScreen())) return
            mvDibujar(event.getGuiGraphics(), true, event.getMouseX(), event.getMouseY())
        } catch (e) {
            mvLog('dibujar chat', e)
        }
    })

    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre', event => {
        try {
            if (!mvEsChat(event.getScreen())) return
            if (event.getButton() != 0) return
            var c = mvCaja()
            var x = event.getMouseX()
            var y = event.getMouseY()
            if (MV.min) {
                if (dentro(x, y, c.tx, c.ty, c.tw, c.th)) {
                    MV.min = false
                    mvGuardarEstado()
                    event.setCanceled(true)
                }
                return
            }
            if (!dentro(x, y, c.px, c.py, c.pw, c.ph)) return
            event.setCanceled(true)
            if (dentro(x, y, c.mx, c.my, c.mw, c.mh)) {
                MV.min = true
                MV.arrastrando = ''
                mvGuardarEstado()
            } else if (dentro(x, y, c.rx, c.ry, c.btw, c.bth)) {
                mvRepetir()
            } else if (dentro(x, y, c.sx, c.sy, c.btw, c.bth)) {
                mvSiguiente()
            } else if (dentro(x, y, c.btx, c.bty, c.btw, c.bth)) {
                mvPausa()
            } else if (dentro(x, y, c.lx1 - 4, c.ly - 6, c.lx2 - c.lx1 + 8, 12)) {
                MV.arrastrando = 'mus'
                mvDesdeX(x, c)
            } else if (c.veh && dentro(x, y, c.vx1 - 4, c.vy - 6, c.vx2 - c.vx1 + 8, 12)) {
                MV.arrastrando = 'veh'
                mtsDesdeX(x, c)
            } else if (c.veh && dentro(x, y, c.ax, c.ky, c.aw, c.kh)) {
                mvTeclasAutos()
            } else if (dentro(x, y, c.kx, c.ky, c.kw, c.kh)) {
                mvTeclasMinecraft()
            }
        } catch (e) {
            mvLog('click', e)
        }
    })

    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseDragged$Pre', event => {
        try {
            if (MV.arrastrando == '') return
            if (!mvEsChat(event.getScreen())) return
            if (MV.arrastrando == 'veh') mtsDesdeX(event.getMouseX(), mvCaja())
            else mvDesdeX(event.getMouseX(), mvCaja())
            event.setCanceled(true)
        } catch (e) {
            mvLog('arrastrar', e)
        }
    })

    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseButtonReleased$Pre', event => {
        try {
            if (MV.arrastrando == '') return
            var que = MV.arrastrando
            MV.arrastrando = ''
            if (que == 'veh') {
                mtsPoner(mtsVol(), true)
            } else {
                $Minecraft.getInstance().options.save()
                mvGuardarEstado()
            }
            event.setCanceled(true)
        } catch (e) {
            mvLog('soltar', e)
        }
    })

    // rueda del raton encima del cuadro: +5% / -5% (arriba = musica, abajo = vehiculos)
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$MouseScrolled$Pre', event => {
        try {
            if (MV.min) return
            if (!mvEsChat(event.getScreen())) return
            var c = mvCaja()
            var x = event.getMouseX()
            var y = event.getMouseY()
            if (!dentro(x, y, c.px, c.py, c.pw, c.ph)) return
            var d = event.getScrollDelta() > 0 ? 0.05 : -0.05
            if (c.veh && y >= c.py + 38) mtsPoner(mtsVol() + d, true)
            else mvPoner(mvVol() + d, true)
            event.setCanceled(true)
        } catch (e) {
            mvLog('rueda', e)
        }
    })

    ForgeEvents.onEvent('net.minecraftforge.client.event.sound.PlaySoundEvent', event => {
        try {
            var snd = event.getOriginalSound()
            if (snd == null) return
            var loc = snd.getLocation()
            if (String(loc.getNamespace()) != 'dinamicas') return
            var p = String(loc.getPath())
            if (p.indexOf('musica.') != 0) return
            MV.cancion = { id: p.substring(7), inst: snd, desde: Date.now() }
            // si la cancion NO esta en tu paquete de recursos no suena nada: se avisa y se pasa a la siguiente
            var existe = true
            try {
                existe = $Minecraft.getInstance().getSoundManager().getSoundEvent(loc) != null
            } catch (e2) {
                mvLog('existe cancion', e2)
            }
            if (!existe) {
                MV.falta = { id: p.substring(7), desde: Date.now(), saltada: false }
                console.warn('musica_volumen.js: el server puso ' + p + ' pero NO esta en tu paquete de recursos (pon el paquete nuevo)')
            }
        } catch (e) {
            mvLog('cancion', e)
        }
    })

    console.info('musica_volumen.js v7: mini menu de musica cargado (abajo a la derecha; con T se usa con el raton)')
}

if (Platform.isClientEnvironment()) {
    try {
        musicaVolumenIniciar()
    } catch (e) {
        console.error('musica_volumen.js: no se pudo cargar el mini menu de musica: ' + e)
    }
}
