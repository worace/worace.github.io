function wkt(geojson) {
  if (geojson.type === "FeatureCollection") {
    const wkts = geojson.features.map(wellknown.stringify);
    return "GEOMETRYCOLLECTION (" + wkts.join(",") + ")";
  } else {
    return wellknown.stringify(geojson);
  }
}
function convertGeoJSON() {
  const rawJSON = $("#geojson-input").val();

  const geojson = JSON.parse(rawJSON);
  const pretty = JSON.stringify(geojson, null, 2)

  $("#geojson-input").val(pretty);

  $("#wkt-output").text(wkt(geojson));
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
