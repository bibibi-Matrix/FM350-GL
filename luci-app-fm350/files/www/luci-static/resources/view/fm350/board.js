'use strict';
'require view';
'require ui';
'require rpc';
'require fm350.common as common';

var callStatus = rpc.declare({ object: 'fm350', method: 'status', expect: {} });

var STYLE = E('style', {}, [
	'.fm350-wrap{display:flex;flex-direction:column;gap:20px;align-items:stretch;}',
	'.fm350-card{flex:1 1 420px;height:auto;min-width:340px;border-radius:12px;',
	' background:var(--card-background,var(--main-background,#ffffff));',
	' border:1px solid var(--border-color,#e3e3e3);',
	' box-shadow:0 2px 10px rgba(0,0,0,.07);}',
	'.fm350-bar{height:6px;width:100%;border-radius:12px 12px 0 0;}',
	'.fm350-body{padding:14px 20px 16px;overflow:visible;}',
	'.fm350-title{font-size:1.05rem;font-weight:600;margin:0 0 4px;}',
	'.fm350-sub{font-size:.78rem;color:var(--text-secondary,#8a8a8a);margin:0 0 12px;}',
	'.fm350-row{display:flex;justify-content:space-between;align-items:center;gap:12px;',
	' padding:7px 0;border-bottom:1px dashed var(--border-color,#ececec);}',
	'.fm350-row:last-child{border-bottom:none;}',
	'.fm350-label{color:var(--text-secondary,#8a8a8a);font-size:.85rem;white-space:nowrap;}',
	'.fm350-val{font-weight:600;font-size:1rem;text-align:right;word-break:break-all;}',
	'.fm350-badge{padding:3px 16px;border-radius:999px;color:#fff;font-weight:700;font-size:.95rem;}',
	'.fm350-pill{padding:1px 10px;border-radius:999px;font-size:.8rem;font-weight:600;margin-left:8px;}',
	'.fm350-ok{background:var(--ok,#2f8f4e);}',
	'.fm350-bad{background:var(--err,#cc3a3a);}',
	'.fm350-warn{background:#c98b1f;}',
	'.fm350-mono{font-family:ui-monospace,Consolas,Menlo,monospace;font-size:.85rem;}',
	'.fm350-pre{white-space:pre-wrap;word-break:break-all;font-size:.8rem;',
	' font-family:ui-monospace,Consolas,Menlo,monospace;margin:2px 0 0;}',
	'.fm350-sig{display:flex;align-items:center;gap:8px;width:100%;}',
	'.fm350-sigtrack{flex:1;height:8px;background:var(--border-color,#e8e8e8);border-radius:999px;overflow:hidden;}',
	'.fm350-sigval{width:64px;text-align:right;font-size:.8rem;}',
	'.fm350-muted{color:var(--text-secondary,#8a8a8a);}'
].join('\n'));

function row(label, valEl) {
	return E('div', { 'class': 'fm350-row' }, [
		E('span', { 'class': 'fm350-label' }, label),
		E('span', { 'class': 'fm350-val' }, valEl)
	]);
}

function fmtBytes(n) {
	n = parseInt(n, 10) || 0;
	if (n < 1024)
		return n + ' Б';
	if (n < 1024 * 1024)
		return (n / 1024).toFixed(1) + ' КБ';
	return (n / 1024 / 1024).toFixed(1) + ' МБ';
}

function setText(el, text) {
	if (el.textContent !== text)
		el.textContent = text;
}

function pillClass(ok) {
	return 'fm350-pill ' + (ok ? 'fm350-ok' : 'fm350-bad');
}

var SIG_TIPS = {
	RSRP: 'Мощность опорного сигнала (уровень сигнала), дБм: чем ближе к 0, тем сильнее',
	RSRQ: 'Качество опорного сигнала, дБ: ≥-10 — хорошо, ≤-15 — плохо',
	SINR: 'SS-SINR (отношение сигнал/шум, из 3GPP AT+CESQ), дБ: ≥15 — хорошо, ≤5 — плохо'
};

// [название, нижняя граница шкалы, верхняя граница шкалы, порог «хорошо», порог «средне», единица]
var SIG_DEFS = [
	[ 'RSRP', -157, -60, -90, -105, ' dBm' ],
	[ 'RSRQ', -20, -3, -10, -15, ' dB' ],
	[ 'SINR', -23, 40, 15, 5, ' dB' ]
];

// Три строки сигнала: шкала обновляется на месте, чтобы ссылки на узлы не терялись
function signalBlock() {
	var bars = E('div', { 'style': 'display:flex;flex-direction:column;gap:6px' });
	var cells = {};

	SIG_DEFS.forEach(function(d) {
		var fill = E('div', { 'style': 'height:100%;width:0%;border-radius:999px' });
		var val = E('span', { 'class': 'fm350-mono fm350-sigval' }, '—');
		bars.appendChild(E('div', { 'class': 'fm350-sig' }, [
			E('span', {
				'style': 'width:52px;color:var(--text-secondary,#8a8a8a);font-size:.8rem;cursor:help',
				'title': SIG_TIPS[d[0]] || ''
			}, d[0]),
			E('span', { 'class': 'fm350-sigtrack' }, fill),
			val
		]));
		cells[d[0]] = { fill: fill, val: val, def: d };
	});

	var note = E('div', {
		'style': 'font-size:.75rem;color:var(--text-secondary,#8a8a8a)',
		'title': SIG_TIPS.RSRP + '; ' + SIG_TIPS.RSRQ + '; ' + SIG_TIPS.SINR
	}, 'RSRP — уровень сигнала · RSRQ — качество сигнала · SINR — SS-SINR (AT+CESQ, дБ, чем выше, тем лучше)');

	var raw = E('pre', { 'class': 'fm350-pre' });
	var wait = E('span', { 'class': 'fm350-muted' }, 'Нет данных о сигнале (ожидание снимка)');

	var box = E('div', {
		'style': 'width:100%;flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;text-align:left'
	}, [ bars, note, raw, wait ]);

	function update(cc) {
		cc = cc || {};
		var hasSig = !!cc.rsrp;
		var hasRaw = !hasSig && !!cc.raw;

		bars.style.display = hasSig ? '' : 'none';
		note.style.display = hasSig ? '' : 'none';
		raw.style.display = hasRaw ? '' : 'none';
		wait.style.display = hasSig || hasRaw ? 'none' : '';
		if (hasRaw)
			setText(raw, String(cc.raw).slice(0, 220));
		if (!hasSig)
			return;

		SIG_DEFS.forEach(function(d) {
			var cell = cells[d[0]];
			var v = parseFloat(cc[d[0].toLowerCase()]);
			if (isNaN(v)) {
				cell.fill.style.width = '0%';
				setText(cell.val, '—');
				return;
			}
			var pct = Math.max(0, Math.min(100, (v - d[1]) / (d[2] - d[1]) * 100));
			cell.fill.style.width = pct.toFixed(0) + '%';
			cell.fill.style.background = v >= d[3] ? '#2f8f4e' : v >= d[4] ? '#c98b1f' : '#cc3a3a';
			setText(cell.val, v + d[5]);
		});
	}

	update(null);
	return { el: box, update: update };
}

// Агрегация несущих: для PCC — фиксированные строки, строки SCC перестраиваются по количеству
function caBlock() {
	var wait = E('span', { 'class': 'fm350-muted' }, 'Ожидание снимка');
	var pill = E('span', {
		'class': 'fm350-pill',
		'title': 'Активна — дополнительная несущая участвует в агрегации (скорость выше); Настроена, но не активна — базовая станция выдала её, но пока не включила, переключение идёт по нагрузке и энергосбережению'
	}, 'Не агрегируется');
	var pillNote = E('span', { 'style': 'margin-left:8px;font-size:.8rem;color:var(--text-secondary,#8a8a8a)' });
	var pcc = E('div', { 'class': 'fm350-mono' });
	var scc = E('div', {});
	var hint = E('div', { 'style': 'font-size:.75rem;color:var(--text-secondary,#8a8a8a)' },
		'PCC — основная несущая, SCC — дополнительная; ARFCN — номер частотного канала, PCI — идентификатор соты; неактивные SCC не учитываются в агрегации');
	var body = E('div', {
		'style': 'display:none;flex-direction:column;gap:4px'
	}, [ E('div', {}, [ pill, pillNote ]), pcc, scc, hint ]);

	var box = E('div', {
		'style': 'flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;text-align:left'
	}, [ wait, body ]);

	function update(ca) {
		ca = ca || {};
		if (ca.pcc_band === undefined && ca.raw === undefined) {
			wait.style.display = '';
			body.style.display = 'none';
			return;
		}
		wait.style.display = 'none';
		body.style.display = 'flex';

		if (ca.aggregated) {
			pill.className = 'fm350-pill fm350-ok';
			pill.style.background = '';
			setText(pill, 'Активно ×' + (ca.scc_active || ca.scc_count));
		}
		else {
			pill.className = 'fm350-pill';
			pill.style.background = '#7d7d7d';
			setText(pill, ca.scc_count > 0 ? 'Настроено, не активно ×' + ca.scc_count : 'Не агрегируется');
		}
		setText(pillNote, ca.aggregated ? 'Дополнительные несущие участвуют в агрегации' : (ca.scc_count > 0 ? 'Дополнительная несущая ожидает активации' : 'Работа на одной несущей'));
		setText(pcc, 'PCC: n' + ca.pcc_band + ' · PCI ' + (ca.pcc_pci || '-') + ' · ARFCN ' + (ca.pcc_arfcn || '-') +
			(ca.pcc_rsrp ? ' · ' + ca.pcc_rsrp + ' dBm' : ''));

		while (scc.firstChild)
			scc.removeChild(scc.firstChild);
		(ca.scc || []).forEach(function(s, i) {
			scc.appendChild(E('div', { 'class': 'fm350-mono' },
				'SCC' + (i + 1) + ': n' + (s.band || '-') + ' · PCI ' + (s.pci || '-') +
				' · ARFCN ' + (s.arfcn || '-') + (s.rsrp ? ' · ' + s.rsrp + ' dBm' : '') +
				' (' + (s.state === 2 ? 'активна' : 'не активна') + ')'));
		});
	}

	update(null);
	return { el: box, update: update };
}

return view.extend({
	load: function() {
		return callStatus();
	},

	render: function(data) {
		var st = (data && data.state) || {};
		var at = (data && data.at) || {};

		// Карточка 1: состояние модуля
		var modelVal = E('span', { 'class': 'fm350-mono' }, '-');
		var simVal = E('span', { 'class': 'fm350-pill fm350-bad' }, 'Неизвестно');
		var copsVal = E('span', {}, '-');
		var stationVal = E('span', { 'class': 'fm350-mono', 'style': 'font-size:.9rem' }, '—');
		var usbVal = E('span', { 'class': 'fm350-mono' }, 'Не найден');
		var atPortVal = E('span', { 'class': 'fm350-mono' }, 'Не готов');
		var snapshotVal = E('span', { 'class': 'fm350-mono', 'style': 'font-size:.85rem' }, 'Нет данных');

		var sig = signalBlock();
		var ca = caBlock();

		var card1 = E('div', { 'class': 'fm350-card', 'style': 'flex:1.1' }, [
			E('div', { 'class': 'fm350-bar', 'style': 'background:#3466d6' }),
			E('div', { 'class': 'fm350-body' }, [
				E('h3', { 'class': 'fm350-title' }, '📡 Состояние модуля'),
				E('p', { 'class': 'fm350-sub' }, 'FM350-GL · автоопределение по USB'),
				row('Модель / прошивка', modelVal),
				row('SIM-карта', simVal),
				row('Оператор', copsVal),
				row('Базовая станция', stationVal),
				row('Снимок данных', snapshotVal),
				E('div', { 'class': 'fm350-row', 'style': 'align-items:flex-start' }, [
					E('span', { 'class': 'fm350-label' }, 'Агрегация несущих'),
					ca.el
				]),
				E('div', { 'class': 'fm350-row', 'style': 'align-items:flex-start' }, [
					E('span', { 'class': 'fm350-label' }, 'Сигнал'),
					sig.el
				]),
				row('USB', usbVal),
				row('Порт AT', atPortVal)
			])
		]);

		// Карточка 2: состояние сети и подключения
		var badge = E('span', { 'class': 'fm350-badge' }, 'Неизвестно');
		var probVal = E('span', {}, 'Всё в порядке');
		var disconnectVal = E('span', {}, '—');
		var v4Text = E('span', { 'class': 'fm350-mono' }, 'Не подключено');
		var v4Pill = E('span', { 'class': 'fm350-pill fm350-bad' }, 'Маршрут отсутствует');
		var v6Text = E('span', { 'class': 'fm350-mono' }, 'Нет');
		var v6Pill = E('span', { 'class': 'fm350-pill fm350-bad' }, 'Маршрут отсутствует');
		var trVal = E('span', { 'class': 'fm350-mono' }, '↓ 0 Б · ↑ 0 Б');
		var card2Bar = E('div', { 'class': 'fm350-bar' });

		var card2 = E('div', { 'class': 'fm350-card' }, [
			card2Bar,
			E('div', { 'class': 'fm350-body' }, [
				E('h3', { 'class': 'fm350-title' }, '🌐 Сеть и подключение'),
				E('p', { 'class': 'fm350-sub' }, 'Служба автовосстановления · обновление каждые 5 с'),
				row('Состояние подключения', badge),
				row('Отключение', disconnectVal),
				row('Текущая проблема', probVal),
				row('IPv4', E('span', {}, [ v4Text, v4Pill ])),
				row('IPv6', E('span', {}, [ v6Text, v6Pill ])),
				row('Счётчик трафика', trVal)
			])
		]);

		function applyStatus(state, atData) {
			state = state || {};
			atData = atData || {};
			var net = state.net || {};
			var usb = state.usb || {};
			var cc = state.cell || {};
			var snaps = state.snapshot || {};
			function snapshotAge(name, fallbackAge) {
				var item = snaps[name] || {};
				if (!item.updated_at)
					return 'нет данных';
				if (!item.available)
					return 'недоступно';
				var maxAge = item.interval || fallbackAge;
				var age = Math.max(0, Math.floor(Date.now() / 1000 - item.updated_at));
				return age > maxAge * 2 ? 'устарело ' + age + ' с' : age + ' с';
			}

			// Состояние модуля
			setText(modelVal, '-');
			if (atData.ati) {
				var m = atData.ati.match(/Model:\s*(\S+)/);
				var r = atData.ati.match(/Revision:\s*(\S+)/);
				setText(modelVal, (m ? m[1] : '') + (r ? ' · ' + r[1] : '') || (atData.ati.split('\n')[0] || '-'));
			}
			var simOk = /READY/.test(atData.cpin || '');
			simVal.className = 'fm350-pill ' + (simOk ? 'fm350-ok' : 'fm350-bad');
			setText(simVal, simOk ? 'ГОТОВА' : ((atData.cpin || '').trim() || 'Неизвестно'));

			setText(copsVal, '-');
			if (atData.cops) {
				var nm = atData.cops.match(/"([^"]+)"/);
				setText(copsVal, (nm ? nm[1] : atData.cops.trim()) + (cc.rat ? ' · ' + cc.rat : ''));
			}

			setText(stationVal,
				(cc.mcc && cc.mnc ? 'MCC ' + cc.mcc + ' · MNC ' + cc.mnc : '') +
				(cc.tac ? ' · TAC ' + cc.tac : '') +
				(cc.cellid ? ' · ' + cc.cellid : '') +
				(cc.band ? ' · Band ' + cc.band : '') || '—');
			setText(usbVal, (usb.path || 'не найден') + (usb.vid ? ' · ' + usb.vid + ':' + usb.pid : ''));
			setText(atPortVal, net.at_port || 'не готов');
			setText(snapshotVal, 'AT ' + snapshotAge('at', 30) + ' · Сота ' + snapshotAge('cell', 120) +
				' · CA ' + snapshotAge('ca', 120));
			sig.update(cc);
			ca.update(state.ca);

			// Сеть и подключение
			var netState = state.state || 'UNKNOWN';
			setText(badge, common.stateName(netState));
			badge.style.background = common.stateColor(netState);
			card2Bar.style.background = common.stateColor(netState);
			var profile = state.profile || {};
			var disconnectNames = {
				enabled: 'Подключение включено',
				disabled: 'Отключено / PDP разорван',
				pending: 'Ожидание отключения',
				failed: 'Не удалось отключить, повтор позже'
			};
			setText(disconnectVal, disconnectNames[profile.disconnect_status] || '—');

			setText(probVal, state.problem
				? state.problem_name + ' · L' + state.recovery_level + ' · ' + state.elapsed + ' с'
				: 'Всё в порядке');

			setText(v4Text, net.v4_at || 'Не подключено');
			v4Pill.className = pillClass(!!net.v4_route);
			setText(v4Pill, net.v4_route ? 'Маршрут в норме' : 'Маршрут отсутствует');

			setText(v6Text, net.v6 || 'Нет');
			v6Pill.className = pillClass(!!net.v6_route);
			setText(v6Pill, net.v6_route ? 'Маршрут в норме' : 'Маршрут отсутствует');

			setText(trVal, '↓ ' + fmtBytes(net.rx) + ' · ↑ ' + fmtBytes(net.tx));
		}

		applyStatus(st, at);

		var body = E('div', { 'class': 'fm350-wrap' }, [ card1, card2 ]);
		body.appendChild(STYLE);

		common.poll(body, 5, function() {
			return callStatus().then(function(d) {
				applyStatus((d && d.state) || {}, (d && d.at) || {});
			}).catch(function() {});
		});

		return body;
	}
});
