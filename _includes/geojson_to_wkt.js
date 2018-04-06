function wkt(geojson) {
  if (geojson.type === "FeatureCollection") {
    const wkts = geojson.features.map(wellknown.stringify);
    return "GEOMETRYCOLLECTION (" + wkts.join(",") + ")";
  } else {
    return wellknown.stringify(geojson);
  }
}

function convertGeoJSON() {
  $("#errors").hide();
  $("#errors").text("");
  const rawJSON = $("#geojson-input").val();

  let geojson;
  try {
    geojson = JSON.parse(rawJSON);
  } catch(e) {
    $("#geojson-form .errors").show();
    $("#geojson-form .errors").text("Invalid JSON: " + e.message);
    return;
  }

  const pretty = JSON.stringify(geojson, null, 2)

  $("#geojson-input").val(pretty);

  try {
    $("#wkt-output").text(wkt(geojson));
  } catch(e) {
    $("#geojson-form .errors").show();
    $("#geojson-form .errors").text("Invalid GeoJSON: Requires a valid GeoJSON Feature or geometry object as input.");
  }
}

function convertWKT() {
  const rawWKT = $.trim($("#wkt-input").val());

  $("#wkt-input").val(rawWKT);
  const geojson = wellknown.parse(rawWKT);
  $("#geojson-output").text(JSON.stringify(geojson));
}

function copyToClipboard(element) {
  var $temp = $("<input>");
  $("body").append($temp);
  $temp.val($(element).text()).select();
  document.execCommand("copy");
  $temp.remove();
}

$(document).ready(() => {
  $("#geojson-form").submit((e) => {
    e.preventDefault();
    convertGeoJSON();
  });

  $("#wkt-form").submit((e) => {
    e.preventDefault();
    convertWKT();
  });

  $("#geojson-input").on('paste', (e) => {
    // const text = e.originalEvent.clipboardData.getData('text');
    setTimeout(convertGeoJSON, 100);
  });
  $("#wkt-input").on('paste', (e) => {
    setTimeout(convertWKT, 100);
  });

  $("#copy-wkt").on('click', (e) => {
    copyToClipboard("#wkt-output");
  });
  $("#copy-geojson").on('click', (e) => {
    copyToClipboard("#geojson-output");
  });
});
