'use strict';
'require view';
'require rpc';
'require fm350.common as common';

var callAt = rpc.declare({ object: 'fm350', method: 'at_exec', params: ['cmd'], expect: {} });
var dangerRe = /AT\+CFUN|GTUSBMODE|QCRMCALL|GTIPPASS|GTAUTOCONNECT/;

var STYLE = E('style', {}, [
	'.fm350-console{max-height:420px;overflow:auto;border-radius:10px;padding:12px 14px;',
	' background:var(--code-background, rgba(20,24,30,.92));color:#d7e2ee;',
	' font-family:ui-monospace,Consolas,Menlo,monospace;font-size:.85rem;',
	' white-space:pre-wrap;word-break:break-all;line-height:1.5;}',
	'.fm350-inputrow{display:flex;gap:8px;margin:10px 0 6px;}',
	'.fm350-inputrow .cbi-input-text{flex:1;}',
	'.fm350-quickrow{margin:8px 0 14px;}',
	'.fm350-quickrow .btn{margin:0 6px 6px 0;}'
].join('\n'));

return view.extend({
	render: function() {
		var input = E('input', {
			'class': 'cbi-input-text',
			'placeholder': 'например: AT+CPIN?   AT+COPS?   AT+GTCCINFO?',
			'style': 'max-width:420px'
		});
		var out = E('pre', { 'class': 'fm350-console' }, 'Здесь появится результат выполнения команды…');

		function send(cmd) {
			if (!cmd)
				return;
			if (dangerRe.test(cmd) && !window.confirm('Эта команда может прервать подключение к сети. Отправить?'))
				return;
			out.textContent += '>> ' + cmd + '\n… ожидание блокировки порта (до 20 с) и выполнение (до 15 с)…\n';
			out.scrollTop = out.scrollHeight;
			common.setLoading(true);
			var timer = setTimeout(function() {
				out.textContent += '[Нет ответа] сервер не ответил за 40 с, попробуйте позже\n\n';
				out.scrollTop = out.scrollHeight;
			}, 40000);
			callAt(cmd).then(function(d) {
				clearTimeout(timer);
				common.setLoading(false);
				if (d.error) {
					out.textContent += '[Ошибка] ' + d.error + '\n\n';
				} else {
					out.textContent += (d.resp && d.resp.trim() ? d.resp : '(пустой ответ: команда может быть не поддерживаться или порт занят, повторите попытку)') + '\n\n';
				}
				out.scrollTop = out.scrollHeight;
			}).catch(function(e) {
				clearTimeout(timer);
				common.setLoading(false);
				out.textContent += '[Ошибка] ' + e + '\n\n';
			});
		}

		var btn = E('button', { 'class': 'btn primary' }, 'Отправить');
		btn.addEventListener('click', function() {
			send(input.value.trim());
		});
		input.addEventListener('keydown', function(e) {
			if (e.key === 'Enter')
				send(input.value.trim());
		});

		var quick = [ 'ATI', 'AT+CPIN?', 'AT+CSQ', 'AT+COPS?', 'AT+CGDCONT?', 'AT+CGPADDR=3', 'AT+GTDNS=3', 'AT+GTCCINFO?', 'AT+CFUN=1,1' ];
		var quickRow = E('div', { 'class': 'fm350-quickrow' });
		quick.forEach(function(c) {
			var b = E('button', { 'class': 'btn' }, c);
			b.addEventListener('click', function() {
				input.value = c;
				send(c);
			});
			quickRow.appendChild(b);
		});

		var body = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, 'Консоль AT-команд'),
			E('p', { 'class': 'muted' }, 'Монопольный доступ к последовательному порту · таймаут выполнения 15 с · опасные команды требуют подтверждения'),
			E('div', { 'class': 'fm350-inputrow' }, [ input, btn ]),
			quickRow,
			out,
			STYLE
		]);
		return body;
	}
});
