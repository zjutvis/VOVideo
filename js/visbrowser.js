"use strict";

// Cookie title for dismissible alerts
var COOKIE_TITLE = "textvis_dismissible_alert_closed";

// The threshold between adjacent year entries to introduce a gap in the time chart
var YEAR_GAP_THRESHOLD = 5; 

// Current window size (used to ignore redundant resize events)
var windowWidth;
var windowHeight;

// Array of categories data as hierarchical structure
var categories = [];
// Map of categories indexed by title
var categoriesMap = {};
// Category indices (used for output sorting purposes)
var categoriesIndices = {};

// List of categories that do not cover the whole entries set
var incompleteCategories = [];

// Map of entries indexed by IDs
var entriesMap = {};

// Categories statistics (used for D3 diagram)
var stats = {};
// Statistics entries map (used for indexing)
var statsMap = {};

// Search field value
var searchText = "";

// Time filter entries
var timeFilterEntries = [];

// References to the time chart-related objects
var timeChartSvg;
var timeChartXScale;
var timeChartYScale;
var timeChartHeight;
var timeChartData;

var buttonColorMap = {};

$(document).ready(function(){
	windowWidth = $(window).width();
	windowHeight = $(window).height();
	
    setupTooltips();
    loadCategories();
    setupHandlers();
    
    // Display the dismissible alert, if necessary
    if ($("#topAlert").length > 0 && !$.cookie(COOKIE_TITLE)) {
    	$("#topAlert").removeClass("hidden");
    }
});

// Handles window resize
$(window).resize(function() {
    if(this.resizeTO) clearTimeout(this.resizeTO);
    this.resizeTO = setTimeout(function() {
        $(this).trigger('resizeEnd');
    }, 500);
});

$(window).bind('resizeEnd', function(){
	// Check if the resize really occurred
	var newWidth = $(window).width();
	var newHeight = $(window).height();
	
	if (newWidth != windowWidth
		|| newHeight != windowHeight) {
		windowWidth = newWidth;
		windowHeight = newHeight;
	} else {
		// Abort the handler
		return;
	}
		
	// Update the layout size
	updateLayoutSize();
});

// Updates the vertical layout size
function updateLayoutSize() {
	var entriesContainer = $("#entriesContainer");
	
	var maxEntriesContainerHeight = $(window).height() - $(".navbar.custom-navbar").height()
		- parseInt($(".navbar.custom-navbar").css("margin-bottom")) * 2;
	
	if (maxEntriesContainerHeight < parseInt(entriesContainer.css("min-height")))
		maxEntriesContainerHeight = parseInt(entriesContainer.css("min-height"));
	
	entriesContainer.height(maxEntriesContainerHeight);
	
	var categoriesListContainer = $("#categoriesList");
	
	var filterPanelTopHeight = 0;
	$("#filtersPanel > *:not(#categoriesList)").each(function(){
		filterPanelTopHeight += $(this).outerHeight();
	});
		
	// Set a reasonable fallback value
	var maxCategoriesListContainerHeight = Math.max(maxEntriesContainerHeight - filterPanelTopHeight, parseInt(entriesContainer.css("min-height")));
		
	categoriesListContainer.height(Math.min(categoriesListContainer[0].scrollHeight, maxCategoriesListContainerHeight));
}


function setupTooltips(){
	$("body").tooltip({
        selector: "[data-tooltip=tooltip], #timeChartSvg g.time-chart-entry.not-gap",
        container: "body",
        placement: "auto"
    });
}

function setupHandlers(){
	$(".search-clear").on("click", onSearchClear);
	$("#searchField").on("keyup", onSearch);
	
	$("#categoriesList")
		.on("click", ".category-entry", onFilterToggle)
		.on("click", ".reset-category-filter", onCategoryFilterReset);
	
	$("#entriesContainer").on("click", ".content-entry", onEntryClick);
	
	$("#entryDetailsModal").on("hidden.bs.modal", onDetailsModalHidden);
	
	
	// Hide the dismissible top alert
	$("#topAlert").on("close.bs.alert", function(){
		$.cookie(COOKIE_TITLE, true, { expires: 365, path: "/" });
	});
}

function onSearch(){
	searchText = $("#searchField").val();
	updateDisplayedEntries();
}

function onSearchClear(){
	$("#searchField").val("");
	$("#searchField").trigger("keyup");
}

function onFilterToggle(){
	var element = $(this);
	
	if (!element.hasClass("active")){
		element.addClass("active");
		element.attr('style', 'width: 7.5rem; height: 7.5rem;background:'+element.attr('id').split('_')[1]+';');
	}else{
		element.removeClass("active");
		element.attr('style', 'width: 7.5rem; height: 7.5rem;background:#FFFFFF;');
	}
	updateCategoryResetButton(element);
	updateDisplayedEntries();
}

function updateCategoryResetButton(element){
	var container = element.parent();
	var resetButton = container.parent().find(".reset-category-filter");
	
	if (container.children(".category-entry:not(.active)").length > 0){
		resetButton.removeClass("hidden");
	}else{
		resetButton.addClass("hidden");
	}
}

function onCategoryFilterReset(){
	var element = $(this);
	$(this).parent().parent().find(".category-entry:not(.active)").each(function(d, i){
	    $(this).attr('style', 'width: 7.5rem; height: 7.5rem;background:' + $(this).attr('id').split('_')[1] + ';');
	});

	element.parent().next(".category-entries-container").children(".category-entry").addClass("active");
	element.addClass("hidden");
	
	updateDisplayedEntries();
}

// Handles the entry click from the main container
function onEntryClick(){
	var id = $(this).data("id");

	if (!entriesMap[id])
		return;
	
	$(this).tooltip("hide");
	
	$(this).addClass("active");
	
	displayEntryDetails(id);
}

// Displays the details dialog for the provided entry ID
// Can be invoked from the summary table handler, for instance
function displayEntryDetails(id) {
	if (!entriesMap[id])
		return;
	
	var entry = entriesMap[id];
	
	//$("#entryDetailsThumbnail").attr("src", entry.thumb200.src);
	// Since the large thumbnails are not preloaded anymore, load the thumbnail via URL
	
	$("#entryDetailsModal .entry-details-field").empty();
	
	$("#entryDetailsTitle").html(entry.title + " (" + entry.year + ")");
	
	if (entry.authors)
		$("#entryDetailsAuthors").html("by " + entry.authors);
	
	if (entry.reference)
		$("#entryDetailsReference").html(entry.reference);
	
	if (entry.url)
		$("#entryDetailsUrl").html("URL: <a href=\"" + entry.url + "\" target=\"_blank\">" + entry.url + "</a>");
	
	$("#entryDetailsBibtex").html("<a href=\"" + ("bibtex/" + entry.id + ".bib" )
			+ "\" target=\"_blank\"><span class=\"glyphicon glyphicon-save\"></span> BibTeX</a>");
			
	$("#entryDetailsThumbnail").attr("src", "paperimg_big/" + id + ".jpg");
	$(".media").attr("style","display: grid");

	$.each(entry.categories, function(i,d){
		var item = categoriesMap[d];

		var element = $("<span class=\"category-entry category-entry-span\""
			    + "data-tooltip=\"tooltip\"></span>");
		element.prop("title", item.descriptionPrefix
				? item.descriptionPrefix + item.description
				: item.description);
		element.append(item.content);

		$("#entryDetailsCategories").append(element);
		$("#entryDetailsCategories").append(" ");
	});

	$("#entryDetailsModal").modal("show");
}


function onDetailsModalHidden(){
	$(".content-entry.active").removeClass("active");
}

function updateDisplayedCount(){
	$("#displayedEntriesCount").text($("#entriesContainer .content-entry").size());
}

function onAddFormReset(){
	//$("#addEntryModal form .form-group").removeClass("has-error").removeClass("has-success");
	$("#inputEntryCategories .category-entry.active").removeClass("active");
}

function loadCategories(){
	$.getJSON("data/categories.json", function(data){
		categories = data;
		categoriesMap = {};
		categoriesIndices = {};

		incompleteCategories = [];

		stats = { description: "VOVideo Survey", children: [] };
		statsMap = {};

		var container = $("#categoriesList");

		for (var i = 0; i < data.length; i++){
		    buttonColorMap[data[i].title] = data[i].entries[0].bgc;
		}

		$.each(categories, function(i,d){
			appendCategoryFilter(d, null, container, stats);
		});

		initializeFormCategories();

		loadContent();
	});
}

// Initializes category data and appends the category filter in a recursive fashion
function appendCategoryFilter(item, parent, currentContainer, currentStats){
	// Check if category is disabled
	if (item.disabled)
		return;

	// Set parent category, if provided
	if (parent)
		item.parentCategory = parent;

	// First of all, include item into the maps
	categoriesMap[item.title] = item;
	categoriesIndices[item.title] = Object.keys(categoriesIndices).length;

	var statsEntry = { title: item.title, description: item.description, ids: {}};
	statsEntry.topCategory = currentStats.topCategory || item.title;
	statsMap[item.title] = statsEntry;
	currentStats.children.push(statsEntry);

	if (item.type == "category") {
		var element = $("<li class=\"list-group-item category-item\"></li>");
		element.attr("data-category", item.title);
		element.append("<h5 class=\"category-title panel-label\">" + item.description + "</h5>");

		currentContainer.append(element);

		statsEntry.children = [];

		// Check if any non-nested child entries are available
		var childEntries = $.grep(item.entries, function(d){ return d.type == "category-entry"});

		if (childEntries.length > 0) {
			var childrenContainer = $("<div class=\"category-entries-container\"></div>");
			childrenContainer.attr("data-category", item.title);
			element.append(childrenContainer);

			// Add the filter reset button
			var resetButton = $("<button type=\"button\" class=\"btn btn-default btn-xs reset-category-filter hidden\" title=\"Reset filters\">"
					+ "<span class=\"glyphicon glyphicon-remove\"></span>"
					+ "</button>");
			resetButton.attr("data-category", item.title);

			element.children(".category-title").append(resetButton);

			$.each(childEntries, function(i,d){
				// Modify child element, if needed
				if (item.childrenDescription)
					d.descriptionPrefix = item.childrenDescription;

				appendCategoryFilter(d, item.title, childrenContainer, statsEntry);
			});
		}

		// Check if any nested child entries are available
		var childCategories = $.grep(item.entries, function(d){ return d.type == "category"});

		if (childCategories.length > 0) {
			var childrenContainer = $("<ul class=\"list-group nested-categories-list\"></ul>");
			element.append(childrenContainer);

			$.each(childCategories, function(i,d){
				appendCategoryFilter(d, item.title, childrenContainer, statsEntry);
			});
		}
	} else if (item.type == "category-entry") {
		var element = $("<button type=\"button\" class=\"btn btn-default category-entry active\""
					    + "data-tooltip=\"tooltip\"></button>");
		element.attr("data-entry", item.title);
		element.prop("title", item.description);
		element.append(item.content);

		element.attr('id',item.title+'_'+item.bgc);
		element.attr('style', 'width: 7.5rem; height: 7.5rem;background:'+item.bgc+';');

		currentContainer.append(element);
		currentContainer.append(" ");
	}

}

// Initializes new entry category filters by copying HTML contents of filters panel
function initializeFormCategories(){
	$("#inputEntryCategories").html($("#categoriesList").html());

	$("#inputEntryCategories button")
	.removeClass("active")
	.attr("data-toggle", "button");
}

// Category entries comparator used for sorting
function categoriesComparator(d1, d2){
	return categoriesIndices[d1] - categoriesIndices[d2];
}

function loadContent(){
	$.getJSON("data/content.json", function(data){
		entriesMap = {};

		$.each(data, function(i,d){
			entriesMap[d.id] = d;

			// Load thumbnails
			d.thumb100 = new Image();
			d.thumb100.src = "paperimg_small/" + d.id + ".jpg";

			// Sort category tags to keep the output order consistent
			d.categories.sort(categoriesComparator);

			// Make sure all categories are lowercase to avoid errors
			for (var i = 0; i < d.categories.length; i++) {
				d.categories[i] = d.categories[i].toLowerCase();
			}

			// Update hierarchical categories
			d.categoriesMap = {};
			$.each(d.categories, function(index, category){
				if (categoriesMap[category] != undefined) {
					var parent = categoriesMap[category].parentCategory;
					if (!d.categoriesMap[parent])
						d.categoriesMap[parent] = [];

					d.categoriesMap[parent].push(category);
				} else {
					console.error("Error: unknown category '" + category + "' detected for '"
							+ d.id + "'", d);
				}
			});

			// Update category stats
			$.each(d.categories, function(index, category){
				if (statsMap[category] != undefined) {
					statsMap[category].ids[d.id] = true;

					// Since this is an entry associated with some category,
					// it means that the immediate parent of the category contains individual
					// categories as "leafs"
					if (categoriesMap[category] && categoriesMap[category].parentCategory) {
						var parent = categoriesMap[category].parentCategory;
						statsMap[parent].hasDirectEntries = true;
					}
				}
			});
		});
		updateDisplayedCount();

		calculateSorting();
		processStatistics();
		appendAuxiliaryFilters();
		markIncompleteCategoryEntries();

		renderTimeChart();

		configureTimeFilter();

		$("#totalTechniquesCount").text(Object.keys(entriesMap).length);

		updateDisplayedEntries();

		// At this stage, the side panel height should be calculated properly
		updateLayoutSize();

		populateSummaryTable();

	});
}


// Calculates a stable sorting order
function calculateSorting(){
	var ids = Object.keys(entriesMap);

	// Sort the entries by year in descending order,
	// entries without proper year value come last.
	// Secondary sorting field is ID (in ascending order), which corresponds to the first author surname.
	ids.sort(function(id1, id2){
		var d1 = entriesMap[id1];
		var d2 = entriesMap[id2];

		if (!d1.year && !d2.year)
			return 0;
		else if (!d1.year)
			return 1;
		else if (!d2.year)
			return -1;

		if (d2.year - d1.year)
			return d2.year - d1.year;

		if (d1.id && d2.id)
			return d1.id.localeCompare(d2.id);
		else
			return 0;
	});

	$.each(ids, function(i,d){
		entriesMap[d].sortIndex = i;
	});
}

// Prepares category statistics for diagram rendering
function processStatistics(){
	// Collect the data in bottom-up fashion
	var aggregate = function(category){
		if (category.children) {
			$.each(category.children, function(i,d){
				var tempResults = aggregate(d);
				if (!category.ids)
					return;

				$.each(tempResults, function(k, v){
					category.ids[k] = v;
				});
			});

		}

		if (category.ids)
			category.value = Object.keys(category.ids).length;

		return category.ids;
	};

	aggregate(stats);
}

// Appends auxiliary filter buttons to categories
// that do not cover the whole entries set
function appendAuxiliaryFilters(){
	var totalCount = Object.keys(entriesMap).length;
	var content = "<span class=\"content-entry-label\">Other</span>";

	$("#categoriesList .category-item").each(function(i,d){
		var element = $(d);
		var title = element.attr("data-category");

		// Prevent erroneous situations, including top-level categories
		// without nested "leaf" entries (such as "data")
		if (!statsMap[title] || !statsMap[title].hasDirectEntries)
			return;

		// Check if category covers the whole set
		if (Object.keys(statsMap[title].ids).length < totalCount) {
			incompleteCategories.push(title);

			var button = $("<button type=\"button\" class=\"btn btn-default category-entry category-other active\""
				    + "data-tooltip=\"tooltip\"></button>");
			button.attr("data-category", title);
			button.prop("title", "Other");
			button.append(content);

			button.attr('style', 'width: 7.5rem; height: 7.5rem; background:' + buttonColorMap[title] + ';');
			button.attr('id', title + '_' + buttonColorMap[title]);
			element.find(".category-entries-container").append(button);
		}
	});
}

// Updates the entries with tags of corresponding "incomplete" categories
function markIncompleteCategoryEntries(){
	$.each(entriesMap, function(id, entry){
		entry.incompleteCategories = getIncompleteCategories(entry);
	});

}

// Returns an array of "incomplete" categories that entry is relevant to
function getIncompleteCategories(entry){
	var candidates = {};

	for (var i = 0; i < incompleteCategories.length; i++){
		candidates[incompleteCategories[i]] = true;
	}

	for (var i = 0; i < entry.categories.length; i++){
		if (categoriesMap[entry.categories[i]]) {
			var parent = categoriesMap[entry.categories[i]].parentCategory;
			delete candidates[parent];
		}
	}

	return Object.keys(candidates);
}

// Prepares the time chart data with year statistics and gaps
function prepareTimeChartData() {
	var yearEntries = [];

	var yearStats = {};
	var minYear = 1e6;
	var maxYear = -1e6;
	var maxYearCount = 0;
	$.each(entriesMap, function(k, v){
		if (!yearStats[v.year])
			yearStats[v.year] = 0;

		yearStats[v.year] += 1;

		if (yearStats[v.year] > maxYearCount)
			maxYearCount = yearStats[v.year];

		if (v.year > maxYear)
			maxYear = v.year;

		if (v.year < minYear)
			minYear = v.year;
	});

	for (var i = minYear; i <= maxYear; i++) {
		if (yearStats[i]) {
			yearEntries.push({
				year: i,
				gap: false,
				total: yearStats[i],
				current: yearStats[i]
			});
		}
	}

	// Detect the gaps between year entries
	// While the long gaps should be filled with special elements, short gaps should be filled with empty years
	var gaps = [];
	for (var i = 1; i < yearEntries.length; i++) {
		if (yearEntries[i].year - yearEntries[i-1].year >= YEAR_GAP_THRESHOLD) {
			gaps.push({
				year: yearEntries[i-1].year + 1,
				gap: true,
				duration: yearEntries[i].year - yearEntries[i-1].year - 1
			})
		} else if (yearEntries[i].year - yearEntries[i-1].year > 1) {
			for (var j = yearEntries[i-1].year + 1; j < yearEntries[i].year; j++) {
				gaps.push({
					year: j,
					gap: false,
					total: 0,
					current: 0
				});
			}
		}
	}

	// Update the time chart data with gaps
	for (var i = 0; i < gaps.length; i++) {
		for (var j = 0; j < yearEntries.length; j++) {
			if (yearEntries[j].year > gaps[i].year) {
				yearEntries.splice(j, 0, gaps[i]);
				break;
			}
		}
	}

	// Finally, return the data and statistics
	return { timeChartData: yearEntries,
			 maxYearCount: maxYearCount };
}

// Renders the bar chart with statistics per year
function renderTimeChart() {
	// Prepare the chart data
	var chartData = prepareTimeChartData();
	timeChartData = chartData.timeChartData;

	// Setup SVG canvas
	var margin = { top: 1, right: 1, bottom: 1, left: 1};

	var outerWidth = Math.round($("#timeChart").width());
	var outerHeight = Math.round($("#timeChart").height());

	var canvasHeight = outerHeight - margin.top - margin.bottom;
	var canvasWidth = outerWidth - margin.left - margin.right;

	timeChartSvg = d3.select($("#timeChart").get(0)).append("svg:svg")
	.attr("id", "timeChartSvg")
	.classed("svg-vis", true)
	.attr("height", outerHeight + "px")
	.attr("width", outerWidth + "px")
	.attr("clip", [margin.top, outerWidth - margin.right, outerHeight - margin.bottom, margin.left].join(" "));

	timeChartSvg.append("rect")
	.classed("svg-fill", true)
	.attr("height", outerHeight)
	.attr("width", outerWidth)
	.style("fill", "white");

	timeChartSvg.append("rect")
	.classed("svg-frame-rect", true)
	.attr("height", outerHeight)
	.attr("width", outerWidth)
	.style("fill", "none")
	.style("stroke", "grey")
	.style("stroke-width", "1");

	var frame = timeChartSvg.append("g")
		.classed("frame-vis", true)
		.attr("id", "timeChartFrame")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	// Prepare the clipping path for inner canvas
	frame.append("clipPath")
		.attr("id", "timeChartCanvasClip")
	.append("rect")
	    .attr("x", 0)
	    .attr("y", 0)
	    .attr("width", canvasWidth)
	    .attr("height", canvasHeight);

	var canvas = frame.append("g")
		.classed("canvas-vis", true)
		.attr("id", "timeChartCanvas")
		.attr("clip-path", "url(#timeChartCanvasClip)");

	// References to scales should be reused
	timeChartXScale = d3.scale.ordinal()
		.domain(timeChartData.map(function(d){return d.year;}))
		.rangeBands([0, canvasWidth]);

	timeChartHeight = canvasHeight;

	timeChartYScale = d3.scale.linear()
		.domain([0, chartData.maxYearCount])
		.range([0, timeChartHeight]);

	// Add the bars
	canvas.selectAll("g.time-chart-entry")
	.data(timeChartData)
	.enter().append("g")
	.classed("time-chart-entry", true)
	.classed("not-gap", function(d){return !d.gap;})
	.attr("transform", function(d){ return "translate(" + timeChartXScale(d.year) + ",0)"; })
	.attr("title", getTimeChartEntryDescription)
	.each(function(d, i){
		var group = d3.select(this);

		if (!d.gap) {
			// Create bars
			group.append("rect")
				.classed("time-chart-total", true)
				.attr("width", timeChartXScale.rangeBand())
				.attr("y", timeChartHeight - timeChartYScale(d.total))
				.attr("height", timeChartYScale(d.total));

			group.append("rect")
				.classed("time-chart-current", true)
				.attr("width", timeChartXScale.rangeBand())
				.attr("y", timeChartHeight - timeChartYScale(d.current))
				.attr("height", timeChartYScale(d.current));

		} else {
			// Create an ellipsis mark
			group.append("text")
				.classed("time-chart-gap", true)
				.text("…")
				.attr("x", timeChartXScale.rangeBand()/2)
				.attr("y", timeChartHeight/2)
				.attr("text-anchor", "middle");
		}

	});
}

// Creates the text description for a time chart entry
function getTimeChartEntryDescription(entry){
	if (!entry.gap) {
		return entry.year + ": "
			+ entry.current + " techniques displayed, "
			+ entry.total + " techniques in total";
	} else {
		return null;
	}
}

// Updates the set of displayed entries based on current filter values
function updateDisplayedEntries(){
	var container = $("#entriesContainer");
	container.empty();

	// Also, remove the tooltips
    $(".tooltip").remove();

	// Get the set of active filters
	var activeFilters = {};
	$(".category-entry.active:not(.category-other)").each(function(){
		var category = $(this).data("entry");
		var parent = categoriesMap[category].parentCategory;
		if (!activeFilters[parent])
			activeFilters[parent] = [];

		activeFilters[parent].push(category);
	});

	// Get the set of inactive filters for "Other" buttons
	var inactiveOthers = [];
	$(".category-other:not(.active)").each(function(){
		inactiveOthers.push($(this).data("category"));
	});

	// Get the time filter range
	var indices = $("#timeFilter").val();
	var yearMin = timeFilterEntries[parseInt(indices[0])];
	var yearMax = timeFilterEntries[parseInt(indices[1])];

	// Filter the entries and sort the resulting array
	var eligibleEntries = $.map(entriesMap, function(entry, index){
		// First of all, check for search text relevancy
		if (!isRelevantToSearch(entry))
			return null;

		// Check the time value
		if (entry.year < yearMin || entry.year > yearMax)
			return null;

		// Check if entry is not relevant to inactive "other" filters
		for (var i = 0; i < entry.incompleteCategories.length; i++) {
			if (inactiveOthers.indexOf(entry.incompleteCategories[i]) != -1)
				return null;
		}

		// Check if all entry's categories are disabled
		for (var k in entry.categoriesMap) {
			if (!activeFilters[k] || !activeFilters[k].length)
				return null;

			var found = false;
			for (var i = 0; i < entry.categoriesMap[k].length; i++) {
				if (activeFilters[k].indexOf(entry.categoriesMap[k][i]) != -1) {
					found = true;
					break;
				}
			}

			if (!found)
				return null;
		}

		return entry;
	});

	// Sort the entries by year in descending order,
	// entries without proper year value come last.
	// Secondary sorting field is reference (in ascending order).
	eligibleEntries.sort(function(d1, d2){
		return d1.sortIndex - d2.sortIndex;
	});

	if (!eligibleEntries.length) {
		container.append("<p class=\"text-muted\">No eligible entries found</p>");
	} else {
		$.each(eligibleEntries, function(i,d){
			var element = $("<div class=\"content-entry\" data-tooltip=\"tooltip\"></div>");
			element.attr("data-id", d.id);
			element.prop("title", d.title + " (" + d.year + ")");

			var image = $("<img class=\"media-object thumbnail100\">");
			image.attr("src", d.thumb100.src);

			element.append(image);
			
			container.append(element);
		});
	}
	
	updateDisplayedCount();
	
	updateTimeChart(eligibleEntries);
}


// Updates the time chart
function updateTimeChart(eligibleEntries) {

	// Update the time chart
	var yearStats = {};
	$.each(eligibleEntries, function(i,d){
		if (!yearStats[d.year])
			yearStats[d.year] = 0;
		
		yearStats[d.year] += 1;
	});
	
	$.each(timeChartData, function(i, d){
		if (d.gap)
			return;
		
		d.current = yearStats[d.year] || 0;
	});
	
	timeChartSvg.selectAll("g.time-chart-entry.not-gap")
	.each(function(d, i){
		if (d.gap)
			return;
		
		var group = d3.select(this);
		
		group.select(".time-chart-current")
			.transition()
				.attr("y", timeChartHeight - timeChartYScale(d.current))
				.attr("height", timeChartYScale(d.current));
		
		group.attr("title", getTimeChartEntryDescription(d));
		// Force Bootstrap tooltip update
		group.attr("data-original-title", getTimeChartEntryDescription(d));
	});
}


// Checks if current entry is relevant to the current search text
function isRelevantToSearch(entry){
	var query = searchText ? searchText.toLowerCase().trim() : null;
	if (!query)
		return true;
	
	// Note: "allAuthors" should be included in order to support alternative name spellings
	var keys = ["id", "title", "year", "authors", "reference", "url", "categories","keywords","venue"];
	for (var i = 0; i < keys.length; i++) {
		if (String(entry[keys[i]]).toLowerCase().indexOf(query) != -1) {
			return true;
		}
	}
	
	// Check the category descriptions as well
	for (var i = 0; i < entry.categories.length; i++){
		if (categoriesMap[entry.categories[i]].description.toLowerCase().indexOf(query) != -1) {
			return true;
		}
	}
	
	return false;
}


function exportBlob(blobData, type){
	var blob = new Blob([blobData], {"type":type});
    var link = window.URL.createObjectURL(blob);
    
    window.open(link, "_blank");
    
	setTimeout(function(){
		window.URL.revokeObjectURL(link);
	}, 10000);
}

// Configures the time filter
function configureTimeFilter() {
	// Get the set of time values
	var values = {};
	$.each(entriesMap, function(i, d){
		if (!isFinite(parseInt(d.year)))
			return;
		
		values[d.year] = true;
	});
	
	// Get the range of time values
	timeFilterEntries = $.map(values, function(d, i){
		return parseInt(i);
	}).sort(function(a, b) {
		  return a - b;
	});
	
	// Update labels
	$("#timeFilterMin").text(timeFilterEntries[0]);
	$("#timeFilterMax").text(timeFilterEntries[timeFilterEntries.length-1]);
	
	// Setup the slider
	$("#timeFilter").noUiSlider({
		start: [0, timeFilterEntries.length-1],
		step: 1,
		range: {
			"min": 0,
			"max": timeFilterEntries.length-1
		},
		behaviour: "drag",
		connect: true
	}).on("slide", onTimeFilterUpdate);
}

// Updates the labels and triggers time filtering
function onTimeFilterUpdate() {
	var indices = $("#timeFilter").val();
	
	$("#timeFilterMin").text(timeFilterEntries[parseInt(indices[0])]);
	$("#timeFilterMax").text(timeFilterEntries[parseInt(indices[1])]);
	
	updateDisplayedEntries();
}

//Populates the summary table
function populateSummaryTable() {
	var container = $("#summaryTableContainer");
	container.empty();
	
	// Create the ordered list of categories
	var categoriesList = [];
	$.each(categoriesMap, function(i, d){
		if (d.type == "category-entry"
			&& !d.disabled)
			categoriesList.push(i);
	});
	categoriesList.sort(categoriesComparator);
	
	// Create the table
	var table = $("<table class=\"table table-bordered table-hover\"></table>");
		
	// Create the header row
	var tableHead = $("<thead></thead>");
	var headerRow = $("<tr></tr>");
	headerRow.append("<th>Technique</th>");
		
	$.each(categoriesList, function(i,d){
		var item = categoriesMap[d];
		
		var element = $("<span class=\"category-entry \""
			    + "data-tooltip=\"tooltip\"></span>");
		element.prop("title", item.descriptionPrefix
				? item.descriptionPrefix + item.description
				: item.description);
		element.append(item.content);
		
		var cell = $("<th class=\"category-cell\"></th>");
		cell.append(element);
		headerRow.append(cell);
	});
	tableHead.append(headerRow);
	table.append(tableHead);
	
	// Get the list of entries sorted by year in increasing order
	var entriesList = $.map(entriesMap, function(d){return d;});
	entriesList.sort(function(d1, d2){
		return d2.sortIndex - d1.sortIndex;
	});
		
	// Create the table body
	var tableBody = $("<tbody></tbody>");
	$.each(entriesList, function(i, d){
		var row = $("<tr></tr>");
		
		// Add the technique title
		row.append("<td class=\"technique-cell\">"
				+ "<span class=\"summary-entry-link-wrapper\">"
				+ "<a href=\"#\" data-id=\"" + d.id + "\" class=\"summary-entry-link\" "
				+ "title=\"" + d.title + " by " + d.authors + " (" + d.year + ")" + "\""
				+ ">" + d.title + " (" + d.year + ")"
				+ "</a>" + "</span>" + "</td>");
		
		// Prepare the set of technique's categories for further lookup
		var hasCategory = {};
		for (var j = 0; j < d.categories.length; j++){
			hasCategory[d.categories[j]] = true;
		}
		
		// Iterate over the general list of categories and append row cells
		for (var j = 0; j < categoriesList.length; j++){
			var cell = $("<td class=\"category-cell\"></td>");
			
			if (hasCategory[categoriesList[j]]) {
				var item = categoriesMap[categoriesList[j]];
				
				cell.addClass("category-present");
				cell.attr("data-tooltip", "tooltip");
				cell.prop("title", item.descriptionPrefix
						? item.descriptionPrefix + item.description
						: item.description);
			}
			
			row.append(cell);
		}
		
		tableBody.append(row);
	});
		
	table.append(tableBody);
		
	// Insert the table into the modal
	container.append(table);
	
	// Setup the handler for links
	table.on("click", ".summary-entry-link", onSummaryEntryLinkClick);
}

// Handles the click on a summary entry link
function onSummaryEntryLinkClick(){
	// Close the summary dialog
	$("#summaryTableModal").modal("hide");
	
	// Emulate the effects of a closed details dialog
	onDetailsModalHidden();
		
	// Get the ID of the entry link
	var id = $(this).data("id");
	
	// Trigger the usual handler
	displayEntryDetails(id);
			
	// Return false to prevent the default handler for hyperlinks
	return false;
}
