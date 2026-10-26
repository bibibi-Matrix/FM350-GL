'use strict';
'require view';
'require rpc';
'require fm350.common as common';

var callLogs = rpc.declare({ object: 'fm350', method: 'logs', params: ['lines'], expect: {} });
var callEvents = rpc.declare({ object: 'fm350', method: 'events', params: ['lines'], expect: {} });
var callEventsClear = rpc.declare({ object: 'fm350', method: 'events_clear', expect: {} });

// Предел отображения: старые строки удаляются автоматически (остаются только последние N)
var MAX_LINES = 80;

function tailLines(text, n) {
	var arr = String(text || '').split('\n');
	while (arr.length > 0 && arr[arr.length - 1] === '')
		arr.pop();
	return arr.length > n ? arr.slice(arr.length - n).join('\n') : arr.join('\n');
}

var STYLE = E('style', {}, [
	'.fm350-log{max-height:340px;overflow:auto;border-radius:10px;padding:12px 14px;',
	' background:var(--code-background, rgba(20,24,30,.92));color:#d7e2ee;',
	' font-family:ui-monospace,Consolas,Menlo,monospace;font-size:.8rem;',
	' white-space:pre-wrap;word-break:break-all;line-height:1.6;}',
	'.fm350-logbar{display:flex;gap:8px;margin:0 0 10px;}'
].join('\n'));

return view.extend({
	render: function() {
		var pre1 = E('pre', { 'class': 'fm350-log' }, 'Загрузка…');
		var pre2 = E('pre', { 'class': 'fm350-log' }, 'Загрузка…');

		// По умолчанию прокрутка к последней строке (вниз)
		function scrollBottom(pre) {
			pre.scrollTop = pre.scrollHeight;
		}

		function refresh() {
			Promise.all([ callLogs(MAX_LINES + 40), callEvents(MAX_LINES + 40) ]).then(function(r) {
				pre1.textContent = tailLines(r[0].logs, MAX_LINES) || '(записей в syslog нет)';
				pre2.textContent = tailLines((r[1].events || []).join('\n'), MAX_LINES) || '(событий нет)';
				scrollBottom(pre1);
				scrollBottom(pre2);
			}).catch(function(e) {
				pre1.textContent = /abort|Abort/i.test(String(e))
					? 'Запрос прерван переходом по странице (это нормально), нажмите «Обновить»'
					: 'Не удалось получить данные: ' + e;
			});
		}

		function clearLogs() {
			pre1.textContent = '(Отображение на этой странице очищено; системный журнал сохранён, нажмите «Обновить», чтобы загрузить снова)';
		}

		function clearEvents() {
			if (!window.confirm('Очистить хронологию событий службы? Содержимое файла событий будет удалено (новые события начнут накапливаться заново).'))
				return;
			callEventsClear().then(function(r) {
				var ok = r && r.ok;
				common.notify(ok ? 'Хронология событий очищена' : ('Не удалось очистить: ' + ((r && r.out) || 'unknown')), ok ? 'info' : 'error');
				pre2.textContent = ok ? '(События очищены)' : pre2.textContent;
			}).catch(function(e) {
				common.notify('Не удалось очистить: ' + ((e && (e.message || e.error)) || e), 'error');
			});
		}

		var bar1 = E('div', { 'class': 'fm350-logbar' }, [
			E('button', { 'class': 'btn primary' }, 'Обновить'),
			E('button', { 'class': 'btn' }, 'Очистить отображение')
		]);
		bar1.children[0].addEventListener('click', refresh);
		bar1.children[1].addEventListener('click', clearLogs);

		var bar2 = E('div', { 'class': 'fm350-logbar' }, [
			E('button', { 'class': 'btn primary' }, 'Обновить'),
			E('button', { 'class': 'btn btn-danger' }, 'Очистить события')
		]);
		bar2.children[0].addEventListener('click', refresh);
		bar2.children[1].addEventListener('click', clearEvents);

		refresh();

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, 'Журнал работы (logread · fm350)'),
			E('p', { 'class': 'muted' }, 'От старых к новым (новые внизу), показаны только последние ' + MAX_LINES + ' строк, при открытии прокрутка к последней строке'),
			bar1,
			pre1,
			E('h3', {}, 'Хронология событий службы'),
			E('p', { 'class': 'muted' }, 'От старых к новым (новые внизу), показаны только последние ' + MAX_LINES + ' записей'),
			bar2,
			pre2,
			STYLE
		]);
	}
});
