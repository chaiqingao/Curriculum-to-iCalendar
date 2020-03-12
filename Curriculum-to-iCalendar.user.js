// ==UserScript==
// @name         课表助手
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  一键导出课表为ics文件
// @author       Qingao Chai
// @match        http://bkjw.whu.edu.cn/stu/stu_index.jsp
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.8/FileSaver.min.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    // 窗口加载完成调用函数
    window.onload = function () {
        // 获取main-->page_iframe-->iframe0
        var iframe0 = document.getElementById("page_iframe").contentDocument.getElementById("iframe0");
        // 非课表页面直接return
        if (iframe0 === null || typeof iframe0 === "undefined") return;
        if (iframe0.getAttribute("src").search("/servlet/Svlt_QueryStuLsn") == -1) return;
        // 获取当前周，因为只有周历模式才有数据，这里利用ajax请求获取页面并解析当前周
        if (typeof window.currentWeek === "undefined") {
            var form = $(iframe0.contentDocument).find("form")[0];
            if (typeof form !== "undefined") {
                $.ajax({
                    cache: true,
                    type: "POST",
                    url: "/servlet/Svlt_QueryStuLsn",
                    data: $(form).serialize(),
                    async: false,
                    error: function (request) {
                        console.log("Connection error:" + request.error);
                    },
                    success: function (data) {
                        var parser = new DOMParser();
                        var htmlDoc = parser.parseFromString(data, "text/html");
                        window.currentWeek = parseInt($(htmlDoc.getElementById("thead_title")).find("span")[0].getAttribute("data-lang-args").split('~')[3]);
                    }
                });
                $.ajax({
                    cache: true,
                    type: "POST",
                    url: "../stu/stu_course_parent.jsp",
                    data: $(form).serialize(),
                    async: false
                });
            }
        }
        // 添加按钮"保存ics"
        var buttons = iframe0.contentDocument.getElementsByName("submit");
        if (buttons === null || typeof buttons === "undefined") return;
        if (buttons.length !== 1) return;
        var button = buttons[0];
        button.outerHTML += '<input type="button" onclick="save()" style="color: #FFF;width: 63px;height: 23px;padding: 0 10px;border: 0;cursor: pointer;margin-left: 10px;border: 1px solid lightgrey;border-radius: 4px;background-image: linear-gradient(#008CDD, #1A55A2);" name="submit" value="保存ics">';
        // 设置上课时间及下课时间
        window.class_start = [[], [8, 0], [8, 50], [9, 50], [10, 40], [11, 30], [14, 5], [14, 55], [15, 45], [16, 40], [17, 30], [18, 30], [19, 20], [20, 10]];
        window.class_time = 45;
        window.weekToNum = { "日": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6 }
        // 添加按钮操作，核心部分
        iframe0.contentWindow.save = function () {
            if (navigator.userAgent.indexOf('MISE') > -1 && navigator.userAgent.indexOf('MSIE 10') == -1) {
                alert('不支持的浏览器');
                return;
            }
            var SEPARATOR = (navigator.appVersion.indexOf('Win') !== -1) ? '\r\n' : '\n';
            var calendar_start = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:Curriculum-to-iCalendar'
            ].join(SEPARATOR);
            var calendar_end = SEPARATOR + 'END:VCALENDAR' + SEPARATOR;
            var calendarEvents = [];
            // 获取到课程表
            var iframe0 = document.getElementById("page_iframe").contentDocument.getElementById("iframe0");
            var table = iframe0.contentDocument.getElementsByTagName("table")[0];
            var rows = table.rows.length;
            var year = $(iframe0.contentDocument).find("select")[0].value;
            var term = $(iframe0.contentDocument).find("select")[1].value;
            var toString = function (date) {
                return date.toISOString().split(/-|:|[.]/).slice(0, 4).join("") + "00Z";
            }
            // 逐行添加event至cal
            for (let i = 1; i < rows; i++) {
                var courseName = table.rows[i].cells[1].innerText;
                var teacherName = table.rows[i].cells[5].innerText;
                var timeAddress = table.rows[i].cells[9].innerText
                if (courseName != "" && timeAddress != "") {
                    var events = timeAddress.split(' ').filter(n => n != "");
                    for (let j = 0; j < events.length; j++) {
                        //周一:1-11周,每1周;1-2节,3区,附3-401 ==> [一,1-11,1,1-2,3区,附3-401]
                        var informations = events[j].split(/周,每|周|节,|:|,|;/).filter(n => n != "");
                        var description = "第" + events[j].split(";")[1] + " " + teacherName;
                        var weekDay = weekToNum[informations[0]];
                        var startWeek = parseInt(informations[1].split("-")[0]);
                        var endWeek = parseInt(informations[1].split("-")[1]);
                        var interval = parseInt(informations[2]);
                        var startTime = class_start[parseInt(informations[3].split('-')[0])];
                        var endTime = class_start[parseInt(informations[3].split('-')[1])];
                        var address = [informations[4], informations[5], teacherName].join(" ");
                        var startDate = new Date(),endDate=new Date(),untilDate=new Date();
                        startDate.setDate(startDate.getDate() - startDate.getDay() - (currentWeek - startWeek) * 7 + weekDay);
                        startDate.setHours(startTime[0], startTime[1], 0, 0);
                        endDate.setDate(endDate.getDate() - endDate.getDay() - (currentWeek - startWeek) * 7 + weekDay);
                        endDate.setHours(endTime[0],endTime[1]+class_time);
                        untilDate.setDate(untilDate.getDate() - untilDate.getDay() + (endWeek - currentWeek) * 7 + weekDay + 1);
                        untilDate.setHours(endTime[0],endTime[1]+class_time);
                        calendarEvents.push([
                            'BEGIN:VEVENT',
                            'DTSTAMP:' + toString(new Date()),
                            'UID:' + calendarEvents.length + '@' + 'https://chaiqingao.github.io/',
                            'SUMMARY:' + courseName,
                            'DTSTART:' + toString(startDate),
                            'DTEND:' + toString(endDate),
                            'RRULE:FREQ=WEEKLY;UNTIL=' + toString(untilDate) + ';INTERVAL=' + interval,
                            'LOCATION:' + address,
                            'DESCRIPTION:' + description,
                            'END:VEVENT'
                        ].join(SEPARATOR));
                    }
                }
            }
            //保存
            if (calendarEvents.length < 1) {
                alert('课表里没课哦~😆');
            } else {
                var fileName = year + "学年第" + term + "学期.ics";
                var calendar = calendar_start + SEPARATOR + calendarEvents.join(SEPARATOR) + calendar_end;
                var blob;
                if (navigator.userAgent.indexOf('MSIE 10') === -1) { // chrome or firefox
                    blob = new Blob([calendar]);
                } else { // ie
                    var bb = new BlobBuilder();
                    bb.append(calendar);
                    blob = bb.getBlob('text/x-vCalendar;charset=' + document.characterSet);
                }
                saveAs(blob, fileName);
            }
        }
    };
    // 保证页面刷新后重新执行
    setInterval(onload, 50);
})();