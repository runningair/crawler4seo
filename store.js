var fs = require('fs');


var record = {
    unreqed: [],
    reqing: {},
    reqed: {},
    errored: {}
};

function logTime(postfix, prefix) {
    prefix || (prefix = '');
    postfix || (postfix = '');
    console.log(prefix + new Date().toISOString() + ' -- ' + postfix);
}

function _getFileCont(fileName) {
    fs.readFile(fileName, function() {
        console.log(arguments)
    });
}

function _justifyFileName(url) {
    return url.replace(/(:)|(\/)/g, function(a) {
        if(a === ':') {
            return '+colon+';
        } else if (a === '/') {
            return '+slash+';
        }
    });
}

var pool = {
    add: function(url) {
        delete record.reqing[url];
        record.unreqed.push(url);
    },
    hasNext: function() {
        return !!record.unreqed.length;
    },
    next: function() {
        var next = record.unreqed.shift();
        return next;
    },
    needReq: function(url) {
        return !record.reqing[url] && !record.reqed[url];
    },
    startReq: function(url) {
        return record.reqing[url] = true;
    },
    addError: function(url) {
        record.errored[url] = true;
    },
    finish: function(url, html) {
        logTime('store url ' + url);
        delete record.reqing[url];
        if (record.errored[url]) {
            delete record.errored[url];
            logTime('error url refetched: ' + url);
        }
        record.reqed[url] = true;
        fs.writeFile('./htmls/' + _justifyFileName(url) + '.html', html, function(err) {
            err && logTime('store html error');
        });
        fs.writeFile('record.json', JSON.stringify(record), function(err) {
            err && logTime('write record error');
        });
    }
};

!function init() {
    var cont;
    try {
        cont = fs.readFileSync('record.json');
    } catch (e) {
        logTime('no local record exists!');
    } finally {
        if (cont) {
            logTime('local record does exist!');
            record = JSON.parse(cont);
        }

        for (var p in record.errored) {
            if (record.errored.hasOwnProperty(p)) {
                record.unreqed.push(p);
            }
        }
    }
}();

exports.add = pool.add;
exports.addError = pool.addError;
exports.hasNext = pool.hasNext;
exports.next = pool.next;
exports.needReq = pool.needReq;
exports.startReq = pool.startReq;
exports.finish = pool.finish;