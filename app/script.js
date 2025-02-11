let currentPage = 1;
const pageSize = 15;

var apiUrl = `https://biscicol.org/arctos/api/v1/query/arctos/_search?size=${pageSize}&from=0`;
var queryStringRootURL = "https://biscicol.org/arctos/api/v1/download/_search?q=";
var downloadLink = "";

var map = L.map('map').setView([0, 0], 2);

const baseLayers = {
  "Regular": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
  }),
  "Topo": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenTopoMap contributors'
  }),
  "Satellite": L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google'
  })
};

baseLayers.Regular.addTo(map);
L.control.layers(baseLayers).addTo(map);
var markersCluster = L.markerClusterGroup().addTo(map);

function showLoader() {
  $("#loader").show();
}

function hideLoader() {
  $("#loader").hide();
}
var requestData = {
  aggs: {
    country_0: {
      terms: { field: "country", size: 10 }
    },
    state_prov_1: {
      terms: { field: "state_prov", size: 10 }
    },
    family_2: {
      terms: { field: "family", size: 10 }
    },
    genus_3: {
      terms: { field: "genus", size: 10 }
    }
  },
  query: {
    bool: {
      must: []
    }
  }
};

// Function to add a facet to the selected list and update the query
function addFacet(field, value) {
  // Add the selected facet to the selectedFacets object
  if (!selectedFacets[field]) {
    selectedFacets[field] = [];
  }
  if (!selectedFacets[field].includes(value)) {
    selectedFacets[field].push(value);
  }
  
  // Update the query part of the request data
  updateQueryWithSelectedFacets();

  // Re-fetch results with the updated query
  fetchResults();
}

// Function to remove a selected facet
function removeFacet(field, value) {
  if (selectedFacets[field]) {
    selectedFacets[field] = selectedFacets[field].filter((v) => v !== value);
    if (selectedFacets[field].length === 0) {
      delete selectedFacets[field];
    }
  }

  // Update the query part of the request data
  updateQueryWithSelectedFacets();

  // Re-fetch results with the updated query
  fetchResults();
}

// Function to update the requestData query based on selected facets and scientific name
function updateQueryWithSelectedFacets() {
  requestData.query.bool.must = []; // Reset the must array

  // Add facet filters
  Object.entries(selectedFacets).forEach(([field, values]) => {
    values.forEach((value) => {
      requestData.query.bool.must.push({ term: { [field]: value } });
    });
  });

  // Add scientific name filter if present
  if (scientificNameFilter) {
    requestData.query.bool.must.push(scientificNameFilter);
  }

  // If no filters are selected, reset to match all
  if (requestData.query.bool.must.length === 0) {
    requestData.query = { match_all: {} };
  }

  // Update the download link with the current query
  updateDownloadLink();
}
var selectedFacets = {};
var scientificNameFilter = null;


// Function to render the results in the UI
function renderResults(results) {
    var table = $("#resultsTable");
    table.find("thead").remove(); // Ensure previous table headers are removed

    var tableBody = $("#resultsTable tbody");
    tableBody.empty(); // Clear existing rows

    var thead = `<thead>
            <tr>
                <th>View Details</th>
                <th>Country</th>
                <th>State/Province</th>
                <th>Family</th>
                <th>Genus</th>
                <th>Scientific Name</th>
                <th>Year</th>
            </tr>
        </thead>`;
    table.prepend(thead); // Add <thead> to the table

    results.forEach(function (doc) {
        var source = doc._source;
        var row = `<tr data-source='${JSON.stringify(source)}'>
            <td class="view-details">
                <i class="fa fa-search view-icon" style="cursor: pointer;" title="View Details"></i>
            </td>
            <td>${source.country || "N/A"}</td>
            <td>${source.state_prov || "N/A"}</td>
            <td>${source.family || "N/A"}</td>
            <td>${source.genus || "N/A"}</td>
            <td>${source.scientific_name || "N/A"}</td>
            <td>${source.year || "N/A"}</td>
        </tr>`;
        tableBody.append(row);
    });

// Add click event listener to the magnifying glass icon to open relatedinformation in a new tab
$(".view-icon").click(function () {
    var sourceData = $(this).closest("tr").data("source");

    if (sourceData && sourceData.relatedinformation) {
        // Extract the URL from the <a> tag using a regex
        var urlMatch = sourceData.relatedinformation.match(/href=["'](.*?)["']/);

        if (urlMatch && urlMatch[1]) {
            window.open(urlMatch[1], '_blank');
        } else {
            alert("No valid related information link available.");
        }
    } else {
        alert("No related information available.");
    }
});


}


// Function to render dynamic facets
function renderFacets(aggregations) {
 
    $("#countryFacets").empty();
    $("#stateProvFacets").empty();
    $("#familyFacets").empty();
    $("#genusFacets").empty();

    // Populate Country facet
    renderFacetLinks(aggregations.country_0, "#countryFacets", "country");

    // Populate State/Province facet
    renderFacetLinks(aggregations.state_prov_1, "#stateProvFacets", "state_prov");

    // Populate Family facet
    renderFacetLinks(aggregations.family_2, "#familyFacets", "family");

    // Populate Genus facet
    renderFacetLinks(aggregations.genus_3, "#genusFacets", "genus");
}

// Helper function to render facet links
function renderFacetLinks(aggregation, container, field) {
    //console.log(`Rendering facet links for: ${field}`);
    //console.log("Aggregation Data:", aggregation);
    
    if (!aggregation || !aggregation.buckets || aggregation.buckets.length === 0) {
        console.warn(`No data found for ${field}`);
        $(container).append(`<p>No data available</p>`);
        return;
    }

    $(container).empty(); // Clear existing facets before rendering new ones

    aggregation.buckets.forEach(function (bucket) {
        //console.log(`Bucket: ${bucket.key} - Count: ${bucket.doc_count}`);
        
        const isSelected = selectedFacets[field] && selectedFacets[field].includes(bucket.key);
        var countFormatted = bucket.doc_count.toLocaleString(); // Format count with commas

        $(container).append(`
            <div class="facet-link-container">
                <a class="facet-link ${isSelected ? 'selected' : ''}" href="#" data-field="${field}" data-value="${bucket.key}">
                    ${bucket.key} (${countFormatted})
                    ${isSelected ? '<span class="remove-facet" data-field="'+field+'" data-value="'+bucket.key+'">X</span>' : ''}
                </a>
            </div>
        `);
    });

    // Add click event listener to dynamically update results
    $(container).off("click", ".facet-link").on("click", ".facet-link", function (event) {
        event.preventDefault();
        var field = $(this).data("field");
        var value = $(this).data("value");

        //console.log(`Facet clicked: ${field} - ${value}`);

        if (!$(this).hasClass('selected')) {
            showLoader(); // Show loader when a facet is clicked
            addFacet(field, value);
        }
    });

    // Add click event listener to remove the facet when "X" is clicked
    $(container).off("click", ".remove-facet").on("click", ".remove-facet", function (event) {
        event.stopPropagation();
        var field = $(this).data("field");
        var value = $(this).data("value");

        //console.log(`Removing facet: ${field} - ${value}`);
        removeFacet(field, value);
    });
}




// Function to render the selected facets separately and persist the "X" button
function renderSelectedFacets() {
    $("#selectedFacets").empty(); // Clear previous selections

    Object.entries(selectedFacets).forEach(([field, values]) => {
        values.forEach((value) => {
            const facetElement = $(`<div class="selected-facet">
                <span>${field.replace(/_/g, " ").toUpperCase()}: ${value}</span>
                <span class="remove-selected-facet" data-field="${field}" data-value="${value}">X</span>
            </div>`);
            
            $("#selectedFacets").append(facetElement);
        });
    });

    // Add click event listener to remove selected facets
    $(".remove-selected-facet").click(function (event) {
        event.stopPropagation();
        var field = $(this).data("field");
        var value = $(this).data("value");
        removeFacet(field, value);
    });
}

// Function to construct the download link based on the current query
function updateDownloadLink() {
    // Convert the JSON query to a Lucene query string
    const luceneQuery = convertJsonToLucene(requestData.query);

    // Construct the download link using the query
    downloadLink = `${queryStringRootURL}${encodeURIComponent(luceneQuery)}&limit=100000`;

    // Enable the download button and update the href attribute
    $("#downloadButton")
        .attr("href", downloadLink)
        .attr("download", "arctos_data.json")
        .prop("disabled", false);
}

// Function to convert JSON query object to Lucene query string
function convertJsonToLucene(jsonQuery) {
    let conditions = [];

    // Check if it's a boolean query with "must" conditions
    if (jsonQuery.bool && Array.isArray(jsonQuery.bool.must)) {
        jsonQuery.bool.must.forEach((condition) => {
            if (condition.term) {
                // Convert term conditions
                for (const [field, value] of Object.entries(condition.term)) {
                    conditions.push(`${field}:"${value}"`);
                }
            } else if (condition.match) {
                // Convert match conditions
                for (const [field, value] of Object.entries(condition.match)) {
                    conditions.push(`${field}:"${value}"`);
                }
            }
        });
    }

    // Join conditions with "AND"
    return conditions.length > 0 ? conditions.join(' AND ') : '*:*'; // Default to match all if empty
}

// Function to render pagination controls
function renderPagination(totalResults) {
    //console.log("Rendering pagination...");
    const paginationContainer = document.getElementById('pagination');
    paginationContainer.innerHTML = ''; // Clear existing pagination

    // Calculate total pages
    const totalPages = Math.ceil(totalResults / pageSize);

    // Add Previous button
    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.className = 'pagination-button';
        prevButton.textContent = 'Previous';
        prevButton.onclick = () => {
            currentPage--;
            fetchResults(); // Fetch new results for the updated page
        };
        paginationContainer.appendChild(prevButton);
    }

    // Display current page number
    const pageInfo = document.createElement('span');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = ` Page ${currentPage} of ${totalPages} `;
    paginationContainer.appendChild(pageInfo);

    // Add Next button
    if (currentPage < totalPages) {
        const nextButton = document.createElement('button');
        nextButton.className = 'pagination-button';
        nextButton.textContent = 'Next';
        nextButton.onclick = () => {
            currentPage++;
            fetchResults(); // Fetch new results for the updated page
        };
        paginationContainer.appendChild(nextButton);
    }
}


// Function to show details modal with _source fields
function showDetailsModal(sourceData) {
    var modal = $("#detailsModal");
    var modalBody = $("#modalBody");
    modalBody.empty(); // Clear previous content

    // Create a container to hold the details
    var contentContainer = $(`
        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
            <div style="flex: 1;">
                <!-- Details will be appended here -->
            </div>
        </div>
    `);

    // Append the container to the modal body
    modalBody.append(contentContainer);

    // Append each key-value pair as a paragraph to the details section
    Object.entries(sourceData).forEach(([key, value]) => {
        if (key === 'relatedInformation' && value) {
            // Ensure it's a proper URL and display it as a hyperlink
            contentContainer.find('div:first-child').append(`<p><strong>${key}:</strong> <a href="${value}" target="_blank">${value}</a></p>`);
        } else {
            // Add the rest of the details normally
            contentContainer.find('div:first-child').append(`<p><strong>${key}:</strong> ${value}</p>`);
        }
    });

    // Show the modal
    modal.css("display", "flex");
}

// Event listener to close the modal
$("#closeModal").click(function () {
    $("#detailsModal").hide();
});


function calculateTotalFromFacets(aggregations) {
    let total = 0;

    // Sum up counts from all available aggregations
    if (aggregations) {
        ["country_0", "state_prov_1", "family_2", "genus_3"].forEach(facet => {
            if (aggregations[facet] && aggregations[facet].buckets) {
                total += aggregations[facet].buckets.reduce((sum, bucket) => sum + bucket.doc_count, 0);
            }
        });
    }

//console.log("total: " + total)
    return total;
}



function fetchResults() {
  showLoader();
  const offset = (currentPage - 1) * pageSize;
  const apiWithPagination = `${apiUrl.split('?')[0]}?size=${pageSize}&from=${offset}`;
//console.log(requestData)
  $.ajax({
    url: apiWithPagination,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify(requestData),
    dataType: "json",
    success: function (response) {
      hideLoader();
      //console.log("API Response:", response);

      if (response && response.hits && response.hits.hits) {
        var results = response.hits.hits;
        var totalResults = response.hits.total.value;

		   var totalResults = calculateTotalFromFacets(response.aggregations); // Total number of results from the facets

        // Calculate showing results range
        const startResult = offset + 1; // Starting index of results shown (1-based)
        const endResult = Math.min(offset + results.length, totalResults); // End index of results shown
        const showingResults = `${startResult} - ${endResult}`; // Format to "Showing X - Y"


        renderResults(results);
        renderFacets(response.aggregations);
        renderSelectedFacets();
        updateDownloadLink();
        renderPagination(totalResults);
        renderMapMarkers(results);
        updateResultsHeading(results.length, totalResults);
      } else {
        console.error("Unexpected response structure:", response);
        alert("Unexpected response structure. Check the console for details.");
      }
    },
    error: function (error) {
      hideLoader();
      console.error("Error fetching data:", error);
    }
  });
}

// Function to render markers on the map using latitude and longitude from the ES data
function renderMapMarkers(results) {
    // Clear existing markers
    markersCluster.clearLayers();

    results.forEach(function (doc) {
        const { dec_lat, dec_long, country, state_prov, family, genus } = doc._source;

        if (dec_lat && dec_long) {
            const marker = L.marker([dec_lat, dec_long]);
            marker.bindPopup(`
                <b>Country:</b> ${country || 'N/A'}<br>
                <b>State/Province:</b> ${state_prov || 'N/A'}<br>
                <b>Family:</b> ${family || 'N/A'}<br>
                <b>Genus:</b> ${genus || 'N/A'}
            `);
            markersCluster.addLayer(marker);
        }
    });

    // Fit the map to show all markers
    if (markersCluster.getLayers().length > 0) {
        map.fitBounds(markersCluster.getBounds());
    }
}

// Function to update the results heading with the number of displayed and total results
function updateResultsHeading(showingResults, totalResults) {
    // Format the numbers with commas for better readability
    const formattedTotalResults = totalResults.toLocaleString();

    // Construct the message for the heading
    const headingMessage = `Showing ${showingResults} of ${formattedTotalResults} total possible results`;

    // Find the element and update its text
    document.getElementById('resultsHeading').textContent = headingMessage;
}

// Toggle between Table and Map view
$("#showTable").click(function () {
    $("#tableContainer").show();
    $("#mapContainer").hide();
    $("#statsContainer").hide();
});

$("#showMap").click(function () {
    $("#mapContainer").show();
    $("#tableContainer").hide();
    $("#statsContainer").hide();

    // Ensure the map resizes properly after being shown
    setTimeout(() => {
        map.invalidateSize(); // Refresh the map layout
    }, 100);
});


// Function to render tables based on aggregations
function renderTables(aggregations) {
  // Helper function to create a table
  function renderTable(id, headers, rows, title) {
    const container = document.getElementById(id);
    container.innerHTML = ""; // Clear previous content

    // Create table title
    const titleElement = document.createElement("h3");
    titleElement.textContent = title;
    container.appendChild(titleElement);

    // Create table element
    const table = document.createElement("table");
    table.classList.add("table", "table-striped");

    // Create table header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Append the table to the container
    container.appendChild(table);
  }

  // Country Table
  const countryBuckets = aggregations.country_0.buckets || [];
  const countryHeaders = ["Country", "Count"];
  const countryRows = countryBuckets.map((bucket) => [bucket.key, bucket.doc_count.toLocaleString()]);
  renderTable("countryTable", countryHeaders, countryRows, "Country Distribution");

  // State/Province Table
  const stateProvBuckets = aggregations.state_prov_1.buckets || [];
  const stateProvHeaders = ["State/Province", "Count"];
  const stateProvRows = stateProvBuckets.map((bucket) => [bucket.key, bucket.doc_count.toLocaleString()]);
  renderTable("stateProvTable", stateProvHeaders, stateProvRows, "State/Province Distribution");

  // Family Table
  const familyBuckets = aggregations.family_2.buckets || [];
  const familyHeaders = ["Family", "Count"];
  const familyRows = familyBuckets.map((bucket) => [bucket.key, bucket.doc_count.toLocaleString()]);
  renderTable("familyTable", familyHeaders, familyRows, "Family Distribution");

  // Genus Table
  const genusBuckets = aggregations.genus_3.buckets || [];
  const genusHeaders = ["Genus", "Count"];
  const genusRows = genusBuckets.map((bucket) => [bucket.key, bucket.doc_count.toLocaleString()]);
  renderTable("genusTable", genusHeaders, genusRows, "Genus Distribution");
}

function fetchStatsData() {
  const statsApiUrl = "https://biscicol.org/arctos/api/v1/query/arctos/_search?size=15&from=0";

console.log("requestData" + JSON.stringify(requestData, null, 2))
  $.ajax({
    url: statsApiUrl,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify(requestData),
    dataType: "json",
    success: function (response) {
      console.log("Stats API Response:", response);

      // Check if aggregations exist in the response
      if (response && response.aggregations) {
        renderTables(response.aggregations);
      } else {
        console.error("No aggregations found in the response.");
        alert("No data available for stats view.");
      }
    },
    error: function (error) {
      console.error("Error fetching stats data:", error);
      alert("Failed to load stats data. Check console for details.");
    },
  });
}
// Toggle to Stats View
$("#showStats").click(function () {
    $("#statsContainer").show();
    $("#mapContainer").hide();
    $("#tableContainer").hide();

    // Fetch and render stats when switching to stats view
    fetchStatsData();
});

$(document).ready(function () {
  fetchResults();
});

