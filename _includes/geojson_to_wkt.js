$(document).ready(() => {
  $("#geojson-form").submit((e) => {
    e.preventDefault();
    console.log(e);
    const rawJSON = $("#geojson-input").val();
    const geojson = JSON.parse(rawJSON);
    const pretty = JSON.stringify(geojson, null, 2)
    $("#geojson-input").val(pretty);
    const wkt = wellknown.stringify(geojson);

    console.log('set wkt: ', wkt);
    $("#wkt-output").text(wkt);
  });

  $("#wkt-form").submit((e) => {
    console.log('submitted');
    e.preventDefault();
    console.log(e);
    const rawWKT = $.trim($("#wkt-input").val());
    $("#wkt-input").val(rawWKT);
    console.log(rawWKT);
    const geojson = wellknown.parse(rawWKT);
    console.log(geojson);

    $("#geojson-output").text(JSON.stringify(geojson));
  });
});
