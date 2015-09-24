var request = require('request'),
    cheerio = require('cheerio'),
    store = require('./store'),
    EventEmitter = require('events').EventEmitter,
    reqMsg = new EventEmitter();

var config = {
    reqNumThrottle: 2
};

var handleHtml, reqHandler;

function logTime(postfix, prefix) {
    prefix || (prefix = '');
    postfix || (postfix = '');
    console.log(prefix + new Date().toISOString() + ' -- ' + postfix);
}

function initEvents() {
    reqMsg.on('req done', function(data) {
        handleHtml(data.url, data.html);
    })
    .on('req error', function(data) {
        logTime('request url error: ' + data.url + ', code: ' + data.statusCode);
        store.addError(data.url);
        store.add(data.url);
        reqHandler.start();
    })
    .on('handle done', function(data) {
        store.finish(data.url, data.html);
    })
}

reqHandler = function() {
    var count = 0;
    function reqUrl(url) {
        ++count;
        logTime('start count: ' + count);
        logTime('start requesting: ' + url);
        request(url, function(error, response, data) {
            if (!error && response.statusCode === 200) {
                logTime('end requesting: ' + url);
                reqMsg.emit('req done', {
                    url: url,
                    html: data
                });
            } else {
                store.add(url);
                reqMsg.emit('req error', {
                    url: url,
                    error: error,
                    statusCode: response ? response.statusCode : -1
                });
            }

            start();

            if (--count === 0) {
                logTime('task done.')
            }
            logTime('end count: ' + count);
        });
    }

    function start(url) {
        var next;
        url && store.add(url);
        while (count < config.reqNumThrottle && store.hasNext()) {
            next = store.next();
            store.needReq(next) && store.startReq(next) && reqUrl(next);
        }
    }

    return {
        start: start
    };
}();

handleHtml = function() {

    function getUrlType(url) {
        if (url.indexOf('?test') !== -1) {
            return 'test';
        } else if (url.indexOf('/case') !== -1) {
            return _determineCaseType(url);
        }

        function _determineCaseType(url) {
            var lastPathVar = url.substr(url.lastIndexOf('/') + 1);
            if (/3[f|F][A-Z0-9]{10}$/.test(lastPathVar)) {
                return 'case-detail';
            } else {
                return 'case-index';
            }
        }
    }

    function _parseSrc2WidthHeight(src) {
        try {
            return src.match(/\d{2,3}x\d{2,3}/)[0].split('x');
        } catch (e) {
            logTime('error: ' + e.stack + ' -- src: ' + src)
        }
    }

    function _testHandler(url, html) {
        logTime('test over');
    }

    //just case detail page
    function _handleCaseDetail(url, html) {
        var $ = cheerio.load(html),
            $scripts = $('script'),
            code = $scripts.eq(-1).html(),
            seajs, window,
            wh, src;

        seajs = {use: function(){}}; // avoid eval error
        window = {};
        eval(code);

        src = window.g_planInfo ? window.g_planInfo.pic : window.g_designInfo.overviewPic;
        wh = _parseSrc2WidthHeight(src);

        $('.case-fpimg img, .case-desimg img').attr({
            src: src,
            width: wh[0],
            height: wh[1],
            alt: window.g_askInfo.title
        });

        if (window.g_rooms) {
            window.g_rooms.map(function(val, i) {
                val.obsPics.map(function(v, j) {
                    $('#photo-' + v.obsPicId + ' .photo').attr({
                        src: v.img,
                        width: v.width,
                        height:v.height,
                        alt: v.desc
                    });
                });
            });
        }

        reqMsg.emit('handle done', {
            url: url,
            html: $.html()
        });
    }

    // case index or case index with filter or with page info
    function _handleCaseIndex(url, html) {
        var $ = cheerio.load(html);
        $('.filter a, .page-next, .list .name a').each(function(i, val) {
            var href = $(val).attr('href');
            href.indexOf('javascript') === -1 && store.add('http://www.kujiale.com' + href);
        });
        reqHandler.start();

        $('.lazyload').each(function(i, val) {
            var $val = $(val),
                src = $val.attr('data-url'),
                wh = _parseSrc2WidthHeight(src),
                alt = $val.closest('.item').find('.name').attr('title');
            $val.attr({
                src: src,
                alt: alt,
                width: wh[0],
                height: wh[1]
            });
        });

        reqMsg.emit('handle done', {
            url: url,
            html: $.html()
        });
    }

    return function(url, html) {
        switch (getUrlType(url)) {
            case 'test': {
                _testHandler(url, html);
                break;
            }
            case 'case-index': {
                logTime('start handle url with case-index: ' + url);
                _handleCaseIndex(url, html);
                break;
            }
            case 'case-detail': {
                logTime('start handle url case-detail: ' + url);
                try {
                    _handleCaseDetail(url, html);
                } catch (e) {
                    logTime('handle detail error: ' + url);
                    store.addError(url);
                    store.add(url);
                    reqHandler.start();
                }
                break;
            }
            default: {
                break;
            }
        }
    };
}();

!function init() {
    initEvents();
    reqHandler.start(' http://www.kujiale.com/case');
}();


// test
