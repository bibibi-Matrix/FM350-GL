'use strict';
'require baseclass';
'require ui';

// Общие для страниц названия состояний, цвета, уведомления и обёртка опроса.
// require в LuCI требует, чтобы фабрика модуля возвращала конструктор (внутри
// он один раз вызывается через new и регистрируется в L.fm350.common),
// поэтому здесь baseclass.extend возвращает класс, а вызывающая сторона
// сразу получает экземпляр с перечисленными ниже методами.

var STATE_NAMES = {
	ABSENT: 'Модуль не в сети',
	PRESENT: 'Модуль готов',
	DIALING: 'Подключение…',
	RECOVERING: 'Восстановление…',
	ONLINE: 'В сети',
	DISABLED: 'Подключение отключено'
};

var STATE_COLORS = {
	ONLINE: '#2f8f4e',
	RECOVERING: '#c98b1f',
	ABSENT: '#cc3a3a',
	DIALING: '#3466d6',
	PRESENT: '#7d7d7d',
	DISABLED: '#7d7d7d'
};

// Если в теме нет перехода .fade-out, кнопка закрытия уведомления не работает:
// подставляем запасной переход и автоматическое скрытие по таймеру
var NOTIFY_CSS = '.alert-message.fade-out{opacity:0 !important;transition:opacity .35s ease !important;}';

return baseclass.extend({
	stateName: function(st) {
		return STATE_NAMES[st] || st;
	},

	stateColor: function(st) {
		return STATE_COLORS[st] || '#7d7d7d';
	},

	stateBadgeClass: function(st) {
		if (st === 'ONLINE')
			return 'label label-warning';
		if (st === 'RECOVERING' || st === 'ABSENT')
			return 'label label-error';
		if (st === 'DIALING')
			return 'label label-info';
		return 'label label-syslog';
	},

	notify: function(msg, type) {
		if (!document.getElementById('fm350-notify-css')) {
			var st = E('style', { 'id': 'fm350-notify-css' }, NOTIFY_CSS);
			document.head.appendChild(st);
		}
		return ui.addTimeLimitedNotification(null, E('p', {}, msg), 8000, type || 'info');
	},

	// В некоторых сборках LuCI у модуля ui нет setLoading
	setLoading: function(on) {
		try { ui.setLoading(on); } catch (e) {}
	},

	// Опрос: после удаления root из документа автоматически снимается,
	// чтобы при переходе на другую страницу не оставались таймеры и запросы
	poll: function(root, interval, fn) {
		var tick = function() {
			if (!root.isConnected) {
				L.Poll.remove(tick);
				return;
			}
			return fn();
		};
		L.Poll.add(tick, interval);
		return tick;
	}
});
