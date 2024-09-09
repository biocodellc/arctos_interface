// API URL
var apiUrl = "https://biscicol.org/phenobase/api/v1/query//phenobase/_search?size=15&from=0";
var queryStringRootURL = "https://biscicol.org/phenobase/api/v1/download/_search?"; // Root URL for download link
var downloadLink = ""; // Holds the constructed download link

// Request payload for the aggregations
var requestData = {
  aggs: {
    datasource_0: {
      terms: {
        field: "datasource",
        size: 10,
      },
    },
    mapped_traits_1: {
      terms: {
        field: "mapped_traits",
        size: 500,
      },
    },
    family_2: {
      terms: {
        field: "family",
        size: 50,
      },
    },
    basis_of_record_3: {
      terms: {
        field: "basis_of_record",
        size: 50,
      },
    },
  },
  query: {
    bool: {
      must: [], // This will hold the selected facet queries and scientific name filter
    },
  },
};

// Keep track of selected facets
var selectedFacets = {};
var scientificNameFilter = null; // To keep track of the scientific name search filter

// Function to fetch data from the Elasticsearch API
function fetchResults() {
  showLoader(); // Show loader when starting a new fetch
  $.ajax({
    url: apiUrl,
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify(requestData),
    dataType: "json",
    success: function (response) {
      hideLoader(); // Hide loader when data is successfully fetched
      console.log("API Response:", response);

      // Ensure the response contains the hits data
      if (response && response.hits && response.hits.hits) {
        var results = response.hits.hits;
        renderResults(results);
        renderFacets(response.aggregations);
        renderSelectedFacets(); // Render selected facets with "X" buttons
        updateDownloadLink(); // Update the download link with the current query
      } else {
        console.error("Unexpected response structure:", response);
        alert("Unexpected response structure. Check the console for details.");
      }
    },
    error: function (error) {
      hideLoader(); // Hide loader in case of an error
      console.error("Error fetching data:", error);
    },
  });
}

// Function to render the results in the UI
function renderResults(results) {
  var tableBody = $("#resultsTable tbody");
  tableBody.empty(); // Clear existing rows

  results.forEach(function (doc) {
    var row = `<tr class="result-row" data-source='${JSON.stringify(
      doc._source
    )}'>
      <td>${doc._source.datasource}</td>
      <td>${doc._source.scientific_name}</td>
      <td>${doc._source.taxon_rank}</td>
      <td>${doc._source.year}</td>
      <td>${doc._source.day_of_year}</td>
      <td>${doc._source.family}</td>
      <td>${doc._source.trait}</td>
      <td>${doc._source.prediction_class}</td>
      <td>
        <a href="${doc._source.observed_image_url}" target="_blank">
          <img src="${doc._source.observed_image_guid}" width="85" height="85" alt="Image">
        </a>
      </td>
    </tr>`;
    tableBody.append(row);
  });

  // Add click event listener to each row to show details in a modal
  $(".result-row").click(function () {
    var sourceData = $(this).data("source");
    showDetailsModal(sourceData);
  });
}

// Function to render dynamic facets
function renderFacets(aggregations) {
  $("#dataSourceFacets").empty();
  $("#traitFacets").empty();
  $("#familyFacets").empty();
  $("#basisOfRecordFacets").empty();

  // Populate DataSource facet
  renderFacetLinks(aggregations.datasource_0, "#dataSourceFacets", "datasource");
  // Populate Trait facet
  renderFacetLinks(aggregations.mapped_traits_1, "#traitFacets", "mapped_traits");
  // Populate Family facet
  renderFacetLinks(aggregations.family_2, "#familyFacets", "family");
  // Populate Basis of Record facet
  renderFacetLinks(aggregations.basis_of_record_3, "#basisOfRecordFacets", "basis_of_record");
}

// Helper function to render facet links
function renderFacetLinks(aggregation, container, field) {
  if (aggregation && aggregation.buckets) {
    aggregation.buckets.forEach(function (bucket) {
      const isSelected = selectedFacets[field] && selectedFacets[field].includes(bucket.key);
      var countFormatted = bucket.doc_count.toLocaleString(); // Format count with commas
      $(container).append(`
        <div class="facet-link-container">
          <a class="facet-link ${isSelected ? 'selected' : ''}" href="#" data-field="${field}" data-value="${bucket.key}">
            ${bucket.key} (${countFormatted}) ${isSelected ? '<span class="remove-facet" data-field="'+field+'" data-value="'+bucket.key+'">X</span>' : ''}
          </a>
        </div>
      `);
    });

    // Add click event listener to dynamically update results
    $(container)
      .find(".facet-link")
      .click(function (event) {
        event.preventDefault();
        var field = $(this).data("field");
        var value = $(this).data("value");
        if (!$(this).hasClass('selected')) {
          showLoader(); // Show loader when a facet is clicked
          addFacet(field, value);
        }
      });

    // Add click event listener to remove the facet when "X" is clicked
    $(container).on("click", ".remove-facet", function (event) {
      event.stopPropagation();
      var field = $(this).data("field");
      var value = $(this).data("value");
      removeFacet(field, value);
    });
  }
}

// Function to render the selected facets separately and persist the "X" button
function renderSelectedFacets() {
  Object.entries(selectedFacets).forEach(([field, values]) => {
    values.forEach((value) => {
      const facetLink = $(`.facet-link[data-field="${field}"][data-value="${value}"]`);
      if (facetLink.length && !facetLink.hasClass('selected')) {
        facetLink.addClass('selected');
        facetLink.append(`<span class="remove-facet" data-field="${field}" data-value="${value}">X</span>`);
      }
    });
  });
}

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

// Function to construct the download link based on the current query
function updateDownloadLink() {
  var queryString = JSON.stringify(requestData.query); // Convert the query to a string
  downloadLink = queryStringRootURL + encodeURIComponent(queryString) + "&limit=100000"; // Construct the download link

  // Enable the download button and update the href attribute
  $("#downloadButton")
    .attr("href", downloadLink)
    .attr("download", "phenobase_data.json")
    .prop("disabled", false);
}

// Function to handle scientific name search
function handleScientificNameSearch() {
  var scientificName = $("#scientificNameSearch").val().trim();

  // Update the scientific name filter
  if (scientificName) {
    scientificNameFilter = { match: { scientific_name: scientificName } };
  } else {
    scientificNameFilter = null; // Clear the filter if input is empty
  }

  // Update the query with selected facets and the scientific name
  updateQueryWithSelectedFacets();

  // Fetch results based on the updated query
  fetchResults();
}

// Event listener for scientific name input field
$("#scientificNameSearch").on("input", function () {
  handleScientificNameSearch(); // Handle changes when text is edited or cleared
});

// Function to show details modal with _source fields
function showDetailsModal(sourceData) {
  var modal = $("#detailsModal");
  var modalBody = $("#modalBody");
  modalBody.empty(); // Clear previous content

  // Display each field in a formatted way
  Object.entries(sourceData).forEach(([key, value]) => {
    modalBody.append(`<p><strong>${key}:</strong> ${value}</p>`);
  });

  // Show the modal
  modal.css("display", "flex");
};

// Event listener to close the modal
$("#closeModal").click(function () {
  $("#detailsModal").hide();
});

// Function to show the loader and disable further interactions
function showLoader() {
  $("#loader").css("display", "flex");
  $(".facet-link").css("pointer-events", "none"); // Disable further clicks on facet links
}

// Function to hide the loader and re-enable interactions
function hideLoader() {
  $("#loader").css("display", "none");
  $(".facet-link").css("pointer-events", "auto"); // Re-enable clicks on facet links
}

// Call fetchResults when the document is ready
$(document).ready(function () {
  fetchResults();
  $("#downloadButton").click(function (event) {
    //alert("downloadbutton pressed")
    updateDownloadLink()
    console.log(downloadLink)
    if (!downloadLink) {
      event.preventDefault(); // Prevent default action if no link is available
    }
  });
});
