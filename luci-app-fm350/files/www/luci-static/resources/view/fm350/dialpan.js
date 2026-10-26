'use strict';
'require view';
'require uci';
'require rpc';
'require fm350.common as common';

var callDial = rpc.declare({ object: 'fm350', method: 'dial_op', params: ['action'], expect: {} });

var STYLE = E('style', {}, [
	'.fm350-chip{display:inline-flex;align-items:center;gap:8px;padding:7px 14px;margin:0 10px 10px 0;',
	' border:1px solid var(--border-color,#e3e3e3);border-radius:999px;',
	' background:var(--background-nth,rgba(0,0,0,.04));font-size:.9rem;}',
	'.fm350-chip b{color:var(--text-secondary,#8a8a8a);font-weight:600;font-size:.8rem;}',
	'.fm350-action{display:flex;align-items:center;gap:14px;padding:10px 4px;',
	' border-bottom:1px solid var(--border-color,#ececec);}',
	'.fm350-action:last-child{border-bottom:none;}',
	'.fm350-action .btn{min-width:130px;margin:0;}',
	'.fm350-action .desc{flex:1;color:var(--text-secondary,#8a8a8a);font-size:.85rem;}',
	'.btn-danger{background:#cc3a3a;border-color:#cc3a3a;color:#fff;}',
	'.btn-danger:hover{background:#a92f2f;border-color:#a92f2f;}'
].join('\n'));

var ITEMS = [
	[ 'enable', 'Включить подключение', '', '' ],
	[ 'disable', 'Отключить интернет', 'Отключает подключение и разрывает PDP-контекст, связь прерывается', 'danger' ],
	[ 'reconnect', 'Переподключиться', 'Повторно активирует PDP (возможен короткий обрыв связи)', 'danger' ],
	[ 'ifup', 'Пересоздать интерфейс', 'Обновляет только интерфейс netifd, модем не затрагивается', '' ],
	[ 'modem_restart', 'Мягкая перезагрузка модема', 'Перезагрузка через AT+CFUN, связь пропадёт примерно на 1 минуту', 'danger' ],
	[ 'usb_reset', 'Аппаратный сброс USB', 'Используется при зависании: переинициализация модема, связь пропадёт на 1–3 минуты', 'danger' ]
];

return view.extend({
	load: function() {
		return uci.load('fm350');
	},

	render: function() {
		var apn = uci.get('fm350', 'profile', 'apn') || 'ctnet';
		var pdp = uci.get('fm350', 'profile', 'pdp_type') || 'ipv4v6';
		var define = uci.get('fm350', 'profile', 'define_connect') || '3';
		var enable = uci.get('fm350', 'profile', 'enable');

		function chip(label, value) {
			return E('span', { 'class': 'fm350-chip' }, [
				E('b', {}, label),
				E('span', { 'style': 'font-weight:600' }, value)
			]);
		}

		var chips = E('div', {}, [
			chip('APN', apn),
			chip('PDP', pdp),
			chip('Контекст', define),
			chip('Подключение', enable === '1' ? 'Включено' : 'Отключено')
		]);

		var actions = E('div', {});
		ITEMS.forEach(function(d) {
			var b = E('button', { 'class': 'btn' + (d[3] === 'danger' ? ' btn-danger' : '') }, d[1]);
			b.addEventListener('click', function() {
				if (d[0] === 'disable' && !window.confirm('После отключения связь 5G прервётся. Продолжить?'))
					return;
				if (d[0] === 'reconnect' && !window.confirm('PDP-контекст будет активирован заново, возможен короткий обрыв связи. Продолжить?'))
					return;
				if (d[0] === 'modem_restart' && !window.confirm('Во время перезагрузки модема связь пропадёт примерно на 1 минуту. Продолжить?'))
					return;
				if (d[0] === 'usb_reset' && !window.confirm('Сброс USB переинициализирует модем, связь пропадёт на 1–3 минуты. Продолжить?'))
					return;
				common.setLoading(true);
				callDial(d[0]).then(function(r) {
					common.setLoading(false);
					common.notify(r.error ? ('Не удалось выполнить: ' + r.error) : ('Команда поставлена в очередь: ' + d[1]),
						r.error ? 'error' : 'info');
				}).catch(function(e) {
					common.setLoading(false);
					common.notify('Ошибка вызова: ' + (e && (e.message || e.error) ? (e.message || e.error) : String(e)), 'error');
				});
			});
			actions.appendChild(E('div', { 'class': 'fm350-action' }, [
				b,
				E('span', { 'class': 'desc' }, d[2])
			]));
		});

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, 'Управление подключением'),
			chips,
			E('p', { 'class': 'muted' }, 'Команда выполняется службой атомарно через очередь — оставаться на этой странице не нужно.'),
			actions,
			STYLE
		]);
	}
});
