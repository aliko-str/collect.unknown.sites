var fs = require("fs");

function getRelevantPopWebsites(){
	var relevantGlobalDomain = "it";
	var relevantPopWebs = [];
	for(var i = 1; i <= 10; i++){
		console.log("PROCESSING: ", i);
		var top1m = require("./tmp1m." + i + ".js");
		
		for(var ikey in top1m){
			var domain = top1m[ikey].split('.');
			domain = domain[domain.length - 1];
			if(domain == relevantGlobalDomain) {
				console.log("FOUND ONE: ", top1m[ikey]);
				relevantPopWebs.push(top1m[ikey]);
			}
		}
	}
	console.log("FOUND ALL, length: ", relevantPopWebs.length);
	var dataToWrite = "module.exports = [" + relevantPopWebs.join('","') + '"]';
	fs.writeFileSync("./popularItalianSites.js", dataToWrite);
	console.log("DONE");
	return;
}

getRelevantPopWebsites();
