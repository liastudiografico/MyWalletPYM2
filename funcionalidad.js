// =======================================================
// APLICACIÓN WALLET: LÓGICA UNIFICADA (jQuery & JS Nativo)
// =======================================================

// --- VARIABLES GLOBALES Y ELEMENTOS DEL DOM (JS Nativo) ---
let contactos = JSON.parse(localStorage.getItem('destinatarios')) || [];

// ---------------------------------------------
// 1. FUNCIONES DE ALMACENAMIENTO Y REFRESCADO
// ---------------------------------------------

function guardarContactos() {
    localStorage.setItem('destinatarios', JSON.stringify(contactos));
}

/**
 * Registra un movimiento (Depósito o Transferencia) en localStorage.
 * @param {string} tipo - 'Transferencia' o 'Depósito'.
 * @param {number} monto - Monto de la transacción.
 * @param {string} detalle - Descripción del movimiento.
 */
function registrarMovimiento(tipo, monto, detalle = '') {
    const movimientos = JSON.parse(localStorage.getItem('movimientos')) || [];
    const isEgreso = tipo === 'Transferencia';

    const newMovement = {
        tipo: tipo,
        // Si es egreso (Transferencia), el monto es negativo
        monto: (isEgreso ? -monto : monto).toFixed(2), 
        fecha: new Date().toLocaleString('es-CL'),
        detalle: detalle
    };
    movimientos.push(newMovement);
    localStorage.setItem('movimientos', JSON.stringify(movimientos));
}

/**
 * Función maestra para actualizar la interfaz completa según la página activa.
 */
function actualizarInterfaz() {
    // Solo llama a la función si el elemento existe en el DOM
    if ($('#contactosTablaBody').length) {
        renderizarContactos(); 
    }
    if ($('#contactoDestino').length) {
        cargarDestinatariosEnvio(); 
    }
    // Llama a renderizar movimientos con el filtro 'todos' por defecto
    if ($('#tablaIngresosBody').length && $('#tablaEgresosBody').length) {
        renderizarMovimientos($('#filtroTipo').val() || 'todos');
    }
}

/**
 * Función de utilidad jQuery para mostrar el saldo formateado.
 * @param {string} elementId - Selector jQuery del elemento donde mostrar el saldo.
 */
function actualizarSaldoDisplay(elementId) {
    const saldo = parseFloat(localStorage.getItem('saldo') || '0.00');
    // Usar toLocaleString para formato de moneda (ej: 100.000,00)
    $(elementId).text(`$${saldo.toLocaleString('es-CL', { minimumFractionDigits: 2 })}`);
}


// ---------------------------------------------
// 2. GESTIÓN DE CONTACTOS (4_destinatarios.html)
// ---------------------------------------------

function renderizarContactos() {
    const tablaBody = $('#contactosTablaBody');
    if (!tablaBody.length) return;

    tablaBody.empty(); // Limpiar tabla con jQuery
    
    if (contactos.length === 0) {
        tablaBody.append(`<tr><td colspan="5" class="text-center text-muted">Aún no hay destinatarios agregados.</td></tr>`);
        return;
    }

    contactos.forEach((contacto, index) => {
        // Añadir el atributo data-contact-index a la fila (<tr>)
        const fila = `
            <tr data-contact-index="${index}"> 
                <td>${contacto.nombre}</td>
                <td>${contacto.banco}</td>
                <td>${contacto.cbu}</td>
                <td>${contacto.alias}</td>
                <td>
                    <button class="btn btn-success btn-sm btn-borrar-contacto" data-index="${index}">
                        Borrar
                    </button>
                </td>
            </tr>
        `;
        tablaBody.append(fila);
    });
    
    // Asignar evento de borrado con jQuery después de renderizar
    $('.btn-borrar-contacto').on('click', function() {
        const index = $(this).data('index');
        eliminarContacto(index);
    });
}

function agregarContacto(event) {
    event.preventDefault(); 
    
    const nuevoContacto = {
        nombre: $('#nombre').val(),
        banco: $('#banco').val(),
        cbu: $('#cbu').val(),
        alias: $('#alias').val(),
    };

    // Validar CBU (ejemplo simple: 6 dígitos)
    if (nuevoContacto.cbu.length !== 6 || !$.isNumeric(nuevoContacto.cbu)) {
         alert('Error: El CBU/CVU debe ser numérico y tener 6 dígitos.');
         return;
    }

    contactos.push(nuevoContacto);
    guardarContactos();
    
    // Ocultar modal y limpiar formulario usando jQuery
    $('#agregarContactoModal').modal('hide'); 
    $('#formAgregarContacto')[0].reset();
    
    actualizarInterfaz();
}

function eliminarContacto(index) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${contactos[index].nombre} de tus destinatarios?`)) {
        contactos.splice(index, 1);
        guardarContactos();
        actualizarInterfaz();
    }
}

// ---------------------------------------------
// 3. ENVÍO DE DINERO (4_destinatarios.html)
// ---------------------------------------------

function cargarDestinatariosEnvio() {
    const selectDestino = $('#contactoDestino');
    if (!selectDestino.length) return;

    selectDestino.empty(); // Limpiar opciones
    selectDestino.append('<option value="" disabled selected>Seleccione un contacto...</option>');

    if (contactos.length === 0) {
        selectDestino.prop('disabled', true);
        return;
    }
    
    selectDestino.prop('disabled', false);

    contactos.forEach((contacto, index) => {
        const option = $('<option>', {
            value: index,
            text: `${contacto.nombre} (${contacto.alias} - ${contacto.banco})`
        });
        selectDestino.append(option);
    });
}

/**
 * Función de utilidad jQuery para mostrar mensajes de Bootstrap
 */
function mostrarMensajeTransferencia(mensaje, tipo) {
    const mensajeDiv = $('#mensajeExitoEnvio');
    mensajeDiv.text(mensaje);
    // Eliminar clases anteriores y añadir la nueva con jQuery
    mensajeDiv.removeClass('d-none alert-success alert-danger ').addClass(`alert-${tipo}`).slideDown();
    
    // Ocultar mensaje después de 4 segundos
    setTimeout(() => {
        mensajeDiv.slideUp(() => mensajeDiv.addClass('d-none'));
    }, 4000);
}

/**
 * Maneja el evento de envío de dinero (Egreso), refactorizado para feedback con jQuery.
 */
function manejarEnvio(event) {
    event.preventDefault();

    const monto = parseFloat($('#monto').val());
    const contactoIndex = $('#contactoDestino').val();

    // --- VALIDACIÓN DE INPUTS ---
    if (isNaN(monto) || monto <= 0) {
        mostrarMensajeTransferencia('Error de validación: Ingrese un monto válido mayor a cero.', 'danger');
        return;
    }
    if (contactoIndex === null || contactoIndex === "") {
        mostrarMensajeTransferencia('Error de validación: Seleccione un destinatario.', 'danger');
        return;
    }

    // --- VALIDACIÓN DE SALDO ---
    let currentBalance = parseFloat(localStorage.getItem('saldo')) || 0.00;
    if (monto > currentBalance) {
        mostrarMensajeTransferencia('Fondos Insuficientes: No tiene saldo suficiente para realizar esta transferencia.', 'danger');
        return;
    }

    // --- PROCESAMIENTO DE TRANSACCIÓN ---
    const destinatario = contactos[contactoIndex]; 
    
    let newBalance = currentBalance - monto;
    localStorage.setItem('saldo', newBalance.toFixed(2));

    const detalleMovimiento = `Transferencia a ${destinatario.nombre} (${destinatario.alias})`;
    registrarMovimiento('Transferencia', monto, detalleMovimiento);

    mostrarMensajeTransferencia(`¡Transacción Exitosa! Se enviaron $${monto.toFixed(2)} a ${destinatario.nombre}. Nuevo Saldo: $${newBalance.toFixed(2)}`, 'success');
    
    // Limpiar el formulario y actualizar interfaces
    $('#formEnvioDinero')[0].reset(); 
    actualizarInterfaz(); 
    
    // Ocultar botón después de la transferencia exitosa y limpiar resaltado
    $('#btnEnviarDineroSubmit').hide();
    $('#contactosTablaBody').find('tr').removeClass('contacto-seleccionado');
}


// ---------------------------------------------
// 4. HISTORIAL DE MOVIMIENTOS (5_transactions.html)
// ---------------------------------------------

/**
 * Renderiza los movimientos en las tablas de ingresos y egresos, aplicando un filtro opcional.
 * @param {string} [filtro='todos'] - 'Depósito', 'Transferencia', o 'todos'.
 */
function renderizarMovimientos(filtro = 'todos') {
    const tablaIngresosBody = document.getElementById('tablaIngresosBody');
    const tablaEgresosBody = document.getElementById('tablaEgresosBody');
    
    if (!tablaIngresosBody || !tablaEgresosBody) return; 

    const $seccionIngresos = $('#seccionIngresos');
    const $seccionEgresos = $('#seccionEgresos');

    // Mostrar/Ocultar secciones según el filtro (jQuery)
    if (filtro === 'Depósito') {
        $seccionIngresos.show();
        $seccionEgresos.hide();
    } else if (filtro === 'Transferencia') {
        $seccionIngresos.hide();
        $seccionEgresos.show();
    } else { // 'todos'
        $seccionIngresos.show();
        $seccionEgresos.show();
    }
    
    // Limpiar las tablas (JS Nativo)
    tablaIngresosBody.innerHTML = '';
    tablaEgresosBody.innerHTML = '';
    
    const movimientos = JSON.parse(localStorage.getItem('movimientos')) || [];
    
    let hayIngresos = false;
    let hayEgresos = false;

    // Recorrer los movimientos del más reciente al más antiguo
    movimientos.slice().reverse().forEach(mov => {
        
        const montoAbsoluto = Math.abs(parseFloat(mov.monto)).toFixed(2);
        const esEgreso = parseFloat(mov.monto) < 0;
        const tipoMovimiento = esEgreso ? 'Transferencia' : 'Depósito';
        
        // Aplicar filtro a los datos
        if (filtro !== 'todos' && tipoMovimiento !== filtro) {
            return;
        }

        const tablaDestino = esEgreso ? tablaEgresosBody : tablaIngresosBody;
        
        if (esEgreso) { hayEgresos = true; } else { hayIngresos = true; }
        
        const fila = tablaDestino.insertRow();
        
        // Columna 1: Detalle / Nombre
        const celdaDetalle = fila.insertCell(0);
        celdaDetalle.innerHTML = `<strong>${mov.detalle}</strong>`;

        // Columna 2: Fecha
        fila.insertCell(1).textContent = mov.fecha;
        
        // Columna 3: Monto
        const celdaMonto = fila.insertCell(2);
        celdaMonto.textContent = `$${montoAbsoluto}`;
        celdaMonto.classList.add(esEgreso ? 'text-danger' : 'text-success', 'font-weight-bold');
    });

    // Mostrar mensajes de "No hay movimientos" si no se encontraron datos
    const mensajeVacio = `<td colspan="3" class="text-center text-muted">No hay movimientos registrados.</td>`;
    
    if ( (filtro === 'todos' || filtro === 'Depósito') && !hayIngresos) {
        tablaIngresosBody.innerHTML = `<tr>${mensajeVacio}</tr>`;
    }
    if ( (filtro === 'todos' || filtro === 'Transferencia') && !hayEgresos) {
         tablaEgresosBody.innerHTML = `<tr>${mensajeVacio}</tr>`;
    }
}

// ---------------------------------------------
// 6. LÓGICA DE INICIALIZACIÓN Y EVENTOS (jQuery)
// ---------------------------------------------

$(document).ready(function() {
    
    // --- 6.1 Lógica del Login (1_login.html) ---
    const loginForm = $('#loginForm'); 
    if (loginForm.length) { 
        loginForm.on('submit', function(event) { 
            event.preventDefault();

            const emailInput = $('#email').val();
            const passwordInput = $('#password').val();
            const modalMensaje = $('#modalMensaje');
            const modalTitle = $('#loginModalLabel');

            const userEmail = "test@example.com";
            const userPassword = "0000";

            modalMensaje.removeClass('alert-success alert-danger');

            if (emailInput === userEmail && passwordInput === userPassword) {
                // INICIO DE SESIÓN EXITOSO
                
                if (localStorage.getItem('saldo') === null) {
                    localStorage.setItem('saldo', '100000.00'); 
                    localStorage.setItem('movimientos', JSON.stringify([])); 
                }
                
                modalTitle.text("Éxito");
                modalMensaje.addClass('alert-success');
                modalMensaje.text("¡Inicio de sesión exitoso! Redirigiendo en 1 segundo...");
                
                $('#loginModal').modal({
                    backdrop: 'static', 
                    keyboard: false
                }).modal('show');
                
                setTimeout(() => {
                    $('#loginModal').modal('hide'); 
                    window.location.href = '2_menu.html';
                }, 1000); 
            } else {
                // INICIO DE SESIÓN FALLIDO
                
                modalTitle.text("Error");
                modalMensaje.addClass('alert-danger');
                modalMensaje.text("Sus datos son incorrectos, ingrese nuevamente.");
                
                $('#loginModal').modal('show');
                
                setTimeout(() => {
                    $('#loginModal').modal('hide'); 
                }, 3000);
            }
        });
    }

    // --- 6.2 Lógica del Menú (2_menu.html) ---
    const saldoElement = $('#saldoActual');
    if (saldoElement.length) {
        
        // Función para mostrar el Toast de redirección (Ventana flotante)
        const showRedirectionToastJQ = (screenName, url) => {
            const toast = $('#toastMessage');
            toast.text(`Redirigiendo a ${screenName}...`);
            toast.addClass("show"); 

            setTimeout(() => {
                toast.removeClass("show");
                window.location.href = url;
            }, 1000);
        };
        
        actualizarSaldoDisplay('#saldoActual'); 

        // Listeners de navegación usando el Toast
        $('#btnDepositar').on('click', function (event) {
            event.preventDefault();
            showRedirectionToastJQ("Depósito", $(this).attr('href'));
        });

        $('#btnEnviarDinero').on('click', function (event) {
            event.preventDefault();
            showRedirectionToastJQ("Envío de Dinero", $(this).attr('href'));
        });

        $('#btnUltimosMovimientos').on('click', function (event) {
            event.preventDefault();
            showRedirectionToastJQ("Últimos Movimientos", $(this).attr('href'));
        });
    }


    // --- 6.3 Lógica de Depósito (3_deposit.html) ---
    const depositForm = $('#depositForm');
    if (depositForm.length) {
        actualizarSaldoDisplay('#currentBalanceDisplay'); 

        depositForm.on('submit', function(event) {
            event.preventDefault();

            const amountToDeposit = parseFloat($('#depositAmount').val());
            const mensajeDiv = $('#mensajeDeposito');

            if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
                mensajeDiv.removeClass('alert-success').addClass("alert alert-danger");
                mensajeDiv.text("Por favor, ingrese un monto válido y positivo.");
                return;
            }

            let currentBalance = parseFloat(localStorage.getItem('saldo')) || 0.00;
            let newBalance = currentBalance + amountToDeposit;

            localStorage.setItem('saldo', newBalance.toFixed(2)); 
            registrarMovimiento('Depósito', amountToDeposit, 'Depósito en efectivo/cuenta');
            
            mensajeDiv.removeClass('alert-danger').addClass("alert alert-success");
            mensajeDiv.html(`Depósito de $${amountToDeposit.toFixed(2)} realizado.<br>Nuevo saldo:$${newBalance.toFixed(2)}`);

            setTimeout(() => {
                window.location.href = '2_menu.html';
            }, 3000);
        });
    }

    // --- 6.4 Lógica de Transferencia y Contactos (4_destinatarios.html) ---
    
    const formAgregarContacto = $('#formAgregarContacto'); 
    const btnEnviarDineroSubmit = $('#btnEnviarDineroSubmit');
    
    if (formAgregarContacto.length) {
        formAgregarContacto.on('submit', agregarContacto);
    }
    
    const formEnvioDinero = $('#formEnvioDinero');
    if (formEnvioDinero.length) {
        formEnvioDinero.on('submit', manejarEnvio);
        
        // Listener para el selector de destinatario
        $('#contactoDestino').on('change', function() {
            const selectedIndex = $(this).val();
            
            // 1. Mostrar/Ocultar el botón
            if (selectedIndex !== null && selectedIndex !== "") {
                btnEnviarDineroSubmit.slideDown(200); // Mostrar suavemente
            } else {
                btnEnviarDineroSubmit.slideUp(200); // Ocultar suavemente
            }

            // 2. Resaltar la fila de la tabla
            const tablaBody = $('#contactosTablaBody');
            tablaBody.find('tr').removeClass('contacto-seleccionado'); // Quitar el resaltado de todas las filas

            if (selectedIndex !== null && selectedIndex !== "") {
                tablaBody.find(`tr[data-contact-index="${selectedIndex}"]`).addClass('contacto-seleccionado');
            }
        });

        // Asegurarse de que el botón esté oculto al cargar la página
        btnEnviarDineroSubmit.hide();
    }
    
    // Lógica de Búsqueda de Contactos
    $('#inputBuscarContacto').on('keyup', function() {
        const busqueda = $(this).val().toLowerCase();
        
        $('#contactosTablaBody tr').filter(function() {
            const contenidoFila = $(this).text().toLowerCase();
            $(this).toggle(contenidoFila.indexOf(busqueda) > -1);
        });
    });

    // --- 6.5 Lógica de Movimientos (5_transactions.html) ---
    const filtroTipo = $('#filtroTipo');
    
    if (filtroTipo.length) {
        // Listener del Filtro
        filtroTipo.on('change', function() {
            renderizarMovimientos($(this).val());
        });
    }
    
    // --- 6.6 INICIALIZACIÓN GENERAL ---
    actualizarInterfaz(); 
});