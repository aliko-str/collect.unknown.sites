var fs = require('fs');
var path = require("path");
var util = require('util');
var http = require("http");
var https = require("https");
var jsdom = require("jsdom");
var sprintf = util.format;
var url = require("url");
var winston = require("winston");
var Promise = require("promise");

var _jqueryStr = fs.readFileSync("./jquery-2.0.3.min.js");

(function runItAll() {
	var settings = require("./settings.js");
	return main(settings).done(function(urlArr) {
		writeUrlsInTxt(settings, urlArr);
	});
})();

function writeUrlsInTxt(settings, urlArr) {
	var outFName = path.resolve(__dirname, settings.outFName);
	var strToSave = urlArr.join('",\n"');
	fs.writeFile(outFName, strToSave, function(err) {
		if(err) {
			return winston.error(err);
		}
		return winston.info("DONE SAVING all urls in the file ", outFName);
	});
	return strToSave;
}

function addOnlyUniqueItems(memoryObj, arrTo, arrFrom){
	for(var ikey in arrFrom){
		var ival = arrFrom[ikey];
		if(!memoryObj[ival]){
			memoryObj[ival] = 1;
			arrTo.push(ival);
		}
	}
	return arrTo;
}

function main(settings) {
	var urlsGatheredPromise = new Promise(function(resolve, reject) {
		var externalUrlStore = [];
		var internalUrlStore = [];
		var _memObjExt = {};
		var _memObjInt = {};
		var _visitCounter = 0;
		var onPageParsed = function(internalUrls, externalUrls) {
			_visitCounter++;
			addOnlyUniqueItems(_memObjExt, externalUrlStore, filterOutSomeUrls(settings, externalUrls));
			addOnlyUniqueItems(_memObjInt, internalUrlStore, internalUrls);
			// externalUrlStore = externalUrlStore.concat(filterOutSomeUrls(settings, externalUrls));
			// internalUrlStore = internalUrlStore.concat(internalUrls);
			if(externalUrlStore.length >= settings.maxUniqueSitesToCollect) {
				winston.info("DONE! Collected the requested number of websites");
				return resolve(externalUrlStore);
			}
			if(!internalUrlStore.length) {
				winston.info("DONE. But we haven't collected the requested number of websites. We've run out of internal Urls to check.");
				winston.info("Only ", externalUrlStore.length, " collected");
				return resolve(externalUrlStore);
			}
			if(_visitCounter >= settings.maxPagesToCrawlThrough) {
				winston.info("DONE. But we haven't collected the requested number of websites: we've reached the max number of pages to sift through.");
				winston.info("Only ", externalUrlStore.length, " collected");
				return resolve(externalUrlStore);
			}
			winston.info("[COLLECTED PAGES] ", externalUrlStore.length);
			extractLinksFromAPage(internalUrlStore.shift(), onPageParsed);
		};
		try {
			extractLinksFromAPage(settings.entryPoint, onPageParsed);
		} catch(err) {
			reject(err);
		}
		return null;
	});
	return urlsGatheredPromise;
}

function filterOutSomeUrls(settings, urls) {
	var result = [];
	var tooPopularUlrs = settings.relevantPopWebs || [];
	for(var i = 0, ilen = urls.length; i < ilen; i++) {
		if(ifHttpUrl(urls[i])){
			var urlsBits = urls[i].split('.');
			if(settings.collectOnly != urlsBits[urlsBits.length - 1]) {
				winston.info("The url: ", urls[i], "didn't belong to the '.it' domain");
			} else {
				var ifTooPopular = false;
				for(var k = 0, klen = tooPopularUlrs.length; k < klen; k++) {
					if(urls[i].indexOf(tooPopularUlrs[k]) !== -1) {
						ifTooPopular = true;
						winston.info("The url: ", urls[i], " belongs to the too-popular list");
						break;
					}
				}
				if(!ifTooPopular) {
					result.push(urls[i]);
				}
			}			
		}
	}
	winston.info("The number of fresh external urls: ", result.length);
	return result;
}

function extractLinksFromAPage(url, callback) {
	function onErrorCallback(request) {
		if(request) {
			request.abort();
			request = null;
		}
		callback([], []);
		return;
	}

	var reqAttemptCounter = 0;
	function requestFunc(url, callback) {
		if(++reqAttemptCounter > 1) {
			onErrorCallback();
			return;
		}
		var timeStampBeforeSend = Date.now();
		var httpModule = checkUrlForNodeHttpModule(url);
		if(!httpModule) {
			console.log("Not 'http://' protocol: " + url);
			onErrorCallback();
			return;
		}
		var request = httpModule.get(url, function(res) {
			var htmlStrStore = "";
			console.log("%s FROM: %s", res.statusCode, url);
			if(res.statusCode >= 500) {
				requestFunc(url, callback);
				return;
			}
			if(res.statusCode < 200 || res.statusCode >= 300) {
				onErrorCallback(request);
				return;
			}
			if(!res.headers["content-type"] || res.headers["content-type"].toLowerCase().indexOf("text/html") == -1) {
				// not HTML --> no page parsing; simpy return an empty array of outgoing urls +
				// abort the request
				console.log("Not-HTML page is met, content-type: " + res.headers["content-type"]);
				onErrorCallback(request);
				return;
			}
			res.on('data', function(d) {
				htmlStrStore += d;
				return;
			});
			res.on('end', function(ev) {
				jsdom.env({
					html : htmlStrStore,
					src : [_jqueryStr],
					done : function(errors, window) {
						if(errors) {
							onErrorCallback(request);
							return console.error("PARSING ERROR: %j", errors);
						} {
							// the actual parsing out of links
							parseHtmlExtractLinks(url, window, callback);
						} {
							// clean up <-- there is a memory leak somewhere down the line
							window.close();
							window = null;
							htmlStrStore = null;
							if(process.memoryUsage().heapUsed > 500000000) {
								console.log("Memory cleaning");
								return global.gc();
							}
						}
						return;
					}
				});
				return;
			});
		});
		request.on('error', (function(url, callback) {
			return function(e) {
				console.error("Re-trying because of: '%s' FROM: %s", e, url);
				requestFunc(url, callback);
				return;
			};
		})(url, callback));
		return request;
	}

	var request = requestFunc(url, callback);
	return;
}

function checkIfSameOrigin(webRoot, url) {
	if(url.indexOf(webRoot) === -1) {
		return false;
	}
	return true;
}

function webrootFromFullUrl(originUrl, windowObj){
	var tmpA = windowObj.document.createElement('a');
	tmpA.setAttribute('href', originUrl);
	var webRoot = tmpA.hostname;
	webRoot = webRoot.split(".");
	webRoot = webRoot[webRoot.length - 2] + "." + webRoot[webRoot.length - 1];
	return webRoot;
}

function parseHtmlExtractLinks(originUrl, windowObj, callback) {
	var externalUrls = [];
	var internalUrls = [];
	var allJqA = windowObj.$("a");
	var webRoot = webrootFromFullUrl(originUrl, windowObj);
	
	for(var i = 0, ilen = allJqA.length;  i < ilen; i++){
		var a = allJqA[i];
		var hrefStr = a.getAttribute("href") || "";
		hrefStr = url.resolve(originUrl, hrefStr);
		hrefStr = hrefStr.replace(a.hash, "");
		if(checkIfSameOrigin(webRoot, hrefStr)) {
			internalUrls.push(hrefStr);
		} else {
			// if we are here, href exists in the link
			externalUrls.push(a.origin);
		}
	}
	return callback(internalUrls, externalUrls);
}

function checkUrlForNodeHttpModule(url) {
	if(url.indexOf("http://") == 0) {
		return http;
	} else if(url.indexOf("https://") == 0) {
		return https;
	}
	return false;
}

function ifHttpUrl(url){
	if(url.indexOf("http://") != -1 || url.indexOf("https://") != -1){
		return true;
	}
	return false;
}
