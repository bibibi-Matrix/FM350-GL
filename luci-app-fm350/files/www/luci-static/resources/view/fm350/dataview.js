'use strict';
'require view';
'require ui';
'require rpc';
'require fm350.common as common';

var callStatus = rpc.declare({ object: 'fm350', method: 'status', params: ['quick'], expect: {} });
var callCell = rpc.declare({ object: 'fm350', method: 'cell', expect: {} });
var callEvents = rpc.declare({ object: 'fm350', method: 'events', params: ['lines'], expect: {} });

function badge(st) {
	return E('span', { 'class': common.stateBadgeClass(st) }, common.stateName(st));
}

function row(label, value) {
	return E('tr', {}, [
		E('th', { 'class': 'col-xs-4' }, label),
		E('td', {}, value)
	]);
}

function table(title, rows) {
	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, title),
		E('table', { 'class': 'table' }, E('tbody', {}, rows))
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			callStatus(),
			callCell(),
			callEvents(15)
		]).then(function(r) {
			return { status: r[0], cell: r[1], events: r[2] };
		});
	},

	render: function(data) {
		var st = data.status.state || {};
		var at = data.status.at || {};

		var modRows = [];
		if (at.ati)
			modRows.push(row('Модель', E('pre', { 'style': 'white-space:pre-wrap;margin:0' }, at.ati)));
		if (at.cpin)
			modRows.push(row('SIM', at.cpin));
		if (at.cops)
			modRows.push(row('Оператор', at.cops));
		if (st.net && st.net.at_port)
			modRows.push(row('Порт AT', st.net.at_port));

		var cc = (data.cell && data.cell.cell) || {};
		if (cc.raw || cc.rsrp) {
			var sigTip = 'RSRP — уровень сигнала (дБм, чем ближе к 0, тем сильнее); RSRQ — качество сигнала (дБ, ≥-10 хорошо); SINR — SS-SINR (из AT+CESQ, дБ, ≥15 хорошо)';
			var sig = E('span', { 'title': sigTip, 'style': 'cursor:help' }, [
				(cc.netmode ? cc.netmode + ' | ' : '') +
				(cc.band ? 'Band ' + cc.band + (cc.bw ? ' (' + cc.bw + ' МГц)' : '') + ' | ' : '') +
				(cc.rsrp ? 'RSRP ' + cc.rsrp + ' dBm | ' : '') +
				(cc.rsrq ? 'RSRQ ' + cc.rsrq + ' dB | ' : '') +
				(cc.sinr ? 'SINR ' + cc.sinr : '')
			]);
			if (!cc.rsrp && cc.raw)
				sig.appendChild(E('pre', { 'style': 'white-space:pre-wrap;margin:0' }, cc.raw));
			modRows.push(row('Сигнал', sig));
			if (cc.ss_rsrp || cc.ss_rsrq || cc.ss_sinr) {
				modRows.push(row('Сигнал (по CESQ)', E('span', {
					'style': 'font-family:var(--font-mono,monospace);font-size:.85rem'
				}, 'SS-RSRP ' + (cc.ss_rsrp || '-') + ' dBm · SS-RSRQ ' + (cc.ss_rsrq || '-') +
					' dB · SS-SINR ' + (cc.ss_sinr || '-') + ' dB')));
			}
			modRows.push(row('Базовая станция', E('span', { 'style': 'font-family:var(--font-mono,monospace);font-size:.85rem' },
				(cc.mcc && cc.mnc ? 'MCC ' + cc.mcc + ' · MNC ' + cc.mnc : '') +
				(cc.tac ? ' · TAC ' + cc.tac : '') +
				(cc.cellid ? ' · Сота ' + cc.cellid : '') +
				(cc.band ? ' · Band ' + cc.band : '') || '—')));
		}

		var ca = st.ca || {};
		if (ca.raw || ca.pcc_band) {
			var caState = ca.aggregated
				? 'Активна (' + (ca.scc_active || ca.scc_count) + ' доп. несущих)'
				: (ca.scc_count > 0 ? 'Настроена, не активна (' + ca.scc_count + ' доп. несущих)' : 'Не агрегируется');
			var caEl = E('span', {}, [
				E('b', {}, caState),
				ca.pcc_band
					? ' ｜ PCC n' + ca.pcc_band + ' · ARFCN ' + (ca.pcc_arfcn || '-') +
					  ' · PCI ' + (ca.pcc_pci || '-') + ' · ' + (ca.pcc_rsrp || '-') + ' dBm'
					: ''
			]);
			(ca.scc || []).forEach(function(s, i) {
				caEl.appendChild(E('div', { 'style': 'font-size:.82rem' },
					'SCC' + (i + 1) + ': n' + (s.band || '-') + ' · PCI ' + (s.pci || '-') +
					' · ARFCN ' + (s.arfcn || '-') + (s.rsrp ? ' · ' + s.rsrp + ' dBm' : '') +
					' (' + (s.state === 2 ? 'активна' : 'не активна') + ')'));
			});
			if (ca.raw)
				caEl.appendChild(E('pre', { 'style': 'white-space:pre-wrap;margin:2px 0 0;font-size:.78rem' }, String(ca.raw)));
			modRows.push(row('Агрегация несущих', caEl));
		}

		var stateEl = badge(st.state);
		var problemVal = E('span', {}, '—');
		var netRows = [
			row('Состояние службы', stateEl),
			row('Текущая проблема', problemVal),
			row('Путь USB', st.usb && st.usb.path
				? st.usb.path + (st.usb.vid ? ' · ' + st.usb.vid + ':' + st.usb.pid : '') +
				  (st.usb.devnode ? ' (' + st.usb.devnode + ')' : '')
				: 'Не найден'),
			row('Сетевой интерфейс', st.net && st.net.ifname ? st.net.ifname : 'Не готов'),
			row('IPv4 (по данным AT)', st.net && st.net.v4_at ? st.net.v4_at : 'Не подключено'),
			row('IPv4 (адрес в ядре)', st.net && st.net.v4_kernel ? st.net.v4_kernel : 'Нет'),
			row('Маршрут IPv4', st.net && st.net.v4_route ? 'Есть' : 'Отсутствует'),
			row('Адрес IPv6', st.net && st.net.v6 ? st.net.v6 : 'Нет'),
			row('Маршрут IPv6', st.net && st.net.v6_route ? 'Есть (' + (st.net.v6_gw ? st.net.v6_gw : '') + ')' : 'Отсутствует')
		];

		if (st.problem)
			problemVal.textContent = st.problem_name + ' (уровень ' + st.recovery_level + ', длится ' + st.elapsed + ' с)';

		var evRows = [];
		(data.events && data.events.events || []).forEach(function(l) {
			evRows.push(E('tr', {}, E('td', {}, E('code', {}, l))));
		});

		var body = E('div', {}, [
			table('Модуль и сигнал', modRows),
			table('Сеть и служба', netRows),
			table('Хронология событий', evRows.length ? evRows : E('td', {}, 'Событий нет'))
		]);

		body.appendChild(E('style', {}, [
			'.fm350-pre{white-space:pre-wrap;word-break:break-all;margin:0;',
			' font-family:ui-monospace,Consolas,Menlo,monospace;font-size:.8rem;}'
		].join('\n')));

		common.poll(body, 5, function() {
			return callStatus().then(function(d) {
				var s2 = (d.state || {}).state;
				stateEl.textContent = common.stateName(s2);
				stateEl.className = common.stateBadgeClass(s2);
				var p2 = d.state || {};
				problemVal.textContent = p2.problem
					? p2.problem_name + ' (уровень ' + p2.recovery_level + ', длится ' + p2.elapsed + ' с)'
					: '—';
			}).catch(function() {});
		});

		return body;
	}
});
