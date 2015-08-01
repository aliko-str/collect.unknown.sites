var settings = {
	// entryPoint : "http://www.italtrade.com/countries/links/links21.htm",
	//entryPoint: "http://www.comuni-italiani.it/",
	// entryPoint: "http://www.tuttitalia.it/scuole/",
	// entryPoint: "http://www.noprofit.org/",
	entryPoint: "http://www.liberliber.it/online/servizi/link-utili/case-editrici/",
	collectOnly : "it",
	onlyNonPopular : true,
	maxUniqueSitesToCollect : 200,
	maxPagesToCrawlThrough : 1000,
	outFName : "italian.publishers.txt",
	relevantPopWebs : [],
	relevantPopWebs_max: 1000
};

module.exports = (function(settings){
	settings.relevantPopWebs = require("./popularItalianSites.js");
	settings.relevantPopWebs.length = settings.relevantPopWebs_max;
	return settings;
})(settings);
