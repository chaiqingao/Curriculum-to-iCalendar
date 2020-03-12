// ==UserScript==
// @name         课表助手
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  一键导出课表为ics文件
// @author       Qingao Chai
// @match        http://bkjw.whu.edu.cn/stu/stu_index.jsp
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require      https://raw.githubusercontent.com/nwcell/ics.js/master/ics.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/1.3.8/FileSaver.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    // 窗口加载完成调用函数
    window.onload=function(){
        // 获取main-->page_iframe-->iframe0
        var iframe0=document.getElementById("page_iframe").contentDocument.getElementById("iframe0");
        // 非课表页面直接return
        if(iframe0 === null || typeof iframe0 === "undefined") return;
        if(iframe0.getAttribute("src").search("/servlet/Svlt_QueryStuLsn")==-1) return;
        // 获取当前周，因为只有周历模式才有数据，这里利用ajax请求获取页面并解析当前周
        if(typeof window.currentWeek === "undefined") {
            var form = $(iframe0.contentDocument).find("form")[0];
            if(typeof(form)!="undefined") {
                $.ajax({
                    cache: true,
                    type: "POST",
                    url:"/servlet/Svlt_QueryStuLsn",
                    data:$(form).serialize(),
                    async: false,
                    error: function(request) {
                        console.log("Connection error:"+request.error);
                    },
                    success: function(data) {
                        var parser=new DOMParser();
                        var htmlDoc=parser.parseFromString(data, "text/html");
                        window.currentWeek=parseInt($(htmlDoc.getElementById("thead_title")).find("span")[0].getAttribute("data-lang-args").split('~')[3]);
                        console.log("set week="+window.currentWeek);
                    }
                });
            }
        }
        // 添加按钮"保存ics"
        var buttons = iframe0.contentDocument.getElementsByName("submit");
        if(buttons === null || typeof buttons === "undefined") return;
        if(buttons.length !== 1) return;
        var button = buttons[0];
        button.outerHTML+='<input type="button" onclick="save()" style="color: #FFF;width: 63px;height: 23px;padding: 0 10px;border: 0;cursor: pointer;margin-left: 10px;border: 1px solid lightgrey;border-radius: 4px;background-image: linear-gradient(#008CDD, #1A55A2);" name="submit" value="保存ics">';
        // 设置上课时间及下课时间
        window.Calendar_start = ['','08:00 am', '08:50 am', '09:50 am','10:40 am','11:30 am','2:05 pm','2:55 pm','3:45 pm','4:40 pm','5:30 pm','6:30 pm','7:20 pm','8:10 pm'];
        window.Calendar_end =   ['','08:45 am', '09:35 am', '10:35 am','11:25 am','12:15 pm','2:50 pm','3:40 pm','4:30 pm','5:25 pm','6:15 pm','7:15 pm','8:05 pm','8:55 pm'];
        window.weekToNum = {"日":0,"一":1,"二":2,"三":3,"四":4,"五":5,"六":6}
        // 添加按钮操作，核心部分
        iframe0.contentWindow.save = function(){
            // 获取到课程表
            var iframe0 = document.getElementById("page_iframe").contentDocument.getElementById("iframe0");
            var table=iframe0.contentDocument.getElementsByTagName("table")[0];
            var rows = table.rows.length;
            var cols = table.rows[0].cells.length;
            var year=$(iframe0.contentDocument).find("select")[0].value;
            var term=$(iframe0.contentDocument).find("select")[1].value;
            var cal=ics("https://chaiqingao.github.io/");
            // 逐行添加event至cal
            for(let i=1;i<rows;i++) {
                var courseName = table.rows[i].cells[1].innerText;
                var teacherName = table.rows[i].cells[5].innerText;
                var timeAddress = table.rows[i].cells[9].innerText
                if(courseName!=""&&timeAddress!=""){
                    var events = timeAddress.split(' ');
                    for(let j=0;j<events.length;j++) {
                        //周一:1-11周,每1周;1-2节,3区,附3-401
                        var o = events[j].split(/周,每|周|节,|:|,|;/).filter(n => n!="");
                        var description = events[j].split(";")[1]+" "+teacherName;
                        var week = weekToNum[o[0]];
                        var startWeek = parseInt(o[1].split("-")[0]);
                        var endWeek = parseInt(o[1].split("-")[1]);
                        var freq = parseInt(o[2]);
                        var startTime = Calendar_start[parseInt(o[3].split('-')[0])];
                        var endTime = Calendar_end[parseInt(o[3].split('-')[1])];
                        var address = o[4]+o[5]+" "+teacherName;
                        var startDate = new Date();
                        startDate.setDate(startDate.getDate()-startDate.getDay()-(currentWeek-startWeek)*7+week);
                        var endDate = new Date();
                        endDate.setDate(endDate.getDate()-endDate.getDay()+(endWeek-currentWeek)*7+week+1);
                        var rrule = {
                            freq: "WEEKLY",
                            until: endDate.toDateString(),
                            interval: freq
                        }
                        cal.addEvent(courseName, description, address, startDate.toDateString()+' '+startTime, startDate.toDateString()+' '+endTime,rrule);
                    }
                }
            }
            //保存
            var res = cal.download(year+"学年第"+term+"学期");
            if(res){
                alert("已保存😜");
            } else {
                alert("课表里没课哦~😆");
            }
        }
    };
    // 保证页面刷新后重新执行
    setInterval(onload,50);
})();