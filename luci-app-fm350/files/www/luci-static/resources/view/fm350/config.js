'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m = new form.Map('fm350', 'Настройки менеджера FM350', 'Изменения вступают в силу после сохранения (служба перечитывает конфигурацию каждый цикл)');

		var s = m.section(form.NamedSection, 'global', 'fm350', 'Общие');
		s.addremove = false;
		s.option(form.Flag, 'enabled', 'Включить менеджер', 'Если выключено, служба не выполняет ни проверок, ни восстановления');
		s.option(form.Value, 'interval', 'Интервал опроса (с)', 'Период проверок и восстановления, рекомендуется 5');
		s.option(form.Value, 'usb_vid_pid', 'USB VID:PID модуля', 'Пусто = автоопределение модуля (по ответу AT на последовательном порту); можно указать вручную, например 0e8d:7127');
		s.option(form.Value, 'at_port', 'Порт AT (пусто — автоопределение)', 'Например /dev/ttyUSB1; если пусто, порт определяет служба');
		s.option(form.Value, 'usb_path_hint', 'Подсказка пути USB (только для предупреждений)', 'Например 1-3.2; при несовпадении пишется событие «смена расположения»');
		s.option(form.Value, 'v4_ifname', 'Имя интерфейса IPv4', 'Интерфейс netifd, по умолчанию wwan_5g_0');
		s.option(form.Value, 'v6_ifname', 'Имя интерфейса IPv6', 'Интерфейс netifd, по умолчанию wwan6_5g_0');
		s.option(form.Flag, 'v6_alias', 'Привязка псевдонима IPv6', 'dhcpv6 привязывается к псевдониму интерфейса IPv4');

		var w = m.section(form.NamedSection, 'watch', 'fm350', 'Служба и восстановление');
		w.addremove = false;
		w.option(form.Value, 'wait_timeout', 'Таймаут ожидания L0 (с)', 'Сколько сначала ждать самовосстановления после сбоя');
		w.option(form.Value, 'recovery_timeout', 'Переход L1 → перезагрузка модема (с)');
		w.option(form.Value, 'usb_reset_timeout', 'Переход L2 → сброс USB (с)');
		w.option(form.Value, 'restart_timeout', 'Период цикла оповещений L3 (с)');
		w.option(form.Value, 'cooldown', 'Пауза между действиями (с)', 'Минимальный интервал между перезагрузками модема и сбросами USB');
		w.option(form.Flag, 'usb_reset_enabled', 'Разрешить сброс на уровне USB', 'Если выключено, на этом уровне выдаётся только предупреждение');
		w.option(form.Flag, 'frozen_enabled', 'Обнаружение зависания канала данных', 'При отсутствии изменения счётчиков сразу выполняется сброс USB (самое действенное)');
		w.option(form.Value, 'frozen_sample', 'Длительность проверки зависания (с)');
		w.option(form.Value, 'frozen_grace', 'Льготный период проверки зависания (с)', 'Период наблюдения после переподключения, смены IP или сброса: зависание не определяется');
		w.option(form.Flag, 'ipv6_check_enabled', 'Проверка IPv6', 'Если выключено, IPv6 не обновляется');
		w.option(form.Value, 'ipv6_ping_target', 'Цель проверки IPv6', 'На практике надёжен только 2400:3200::1');
		w.option(form.Value, 'ipv6_ping_interval', 'Период проверки IPv6 (с)', 'Сбой фиксируется только после 2 неудач подряд, единичный сбой ICMP восстановления не запускает');
		w.option(form.Value, 'ipv4_ping_target', 'Цель проверки доступности IPv4', 'Для определения зависания используется публичный DNS (ICMP до шлюза обычно фильтруется, шлюз не указывать)');
		w.option(form.Flag, 'ca_check_enabled', 'Опрос состояния агрегации несущих', 'Периодически читает AT+GTCAINFO? и показывает в интерфейсе (в прошивке модуля нет команд включения/настройки CA, здесь только мониторинг)');
		w.option(form.Value, 'ca_interval', 'Период опроса CA (с)');
		w.option(form.Flag, 'ipv6_escalate', 'Эскалация при сбое обновления IPv6', 'После 3 неудачных обновлений подряд запускается общее восстановление');
		w.option(form.Value, 'reappear_timeout', 'Время до предупреждения об отсутствии (с)', 'Предупреждение, если модуль отсутствует дольше этого времени');

		var p = m.section(form.NamedSection, 'profile', 'fm350', 'Настройки подключения');
		p.addremove = false;
		p.option(form.Flag, 'enable', 'Включить подключение', 'Если выключено, служба остаётся в отключённом состоянии (переключается на странице подключения)');
		p.option(form.Value, 'apn', 'APN');
		p.option(form.Value, 'pdp_type', 'Тип PDP', 'ipv4 / ipv6 / ipv4v6');
		p.option(form.Value, 'define_connect', 'Номер PDP-контекста', 'В текущей прошивке — 3');
		p.option(form.Flag, 'presets_enabled', 'Заводские пресеты', 'AT+GTAUTODHCP / GTIPPASS / GTAUTOCONNECT, по умолчанию выключено');

		var n = m.section(form.NamedSection, 'notify', 'fm350', 'Журнал');
		n.addremove = false;
		n.option(form.Value, 'events_keep', 'Сколько событий хранить');

		return m.render();
	}
});
