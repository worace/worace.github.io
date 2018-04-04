$(document).ready(() => {
  $("#geojson-form").submit((e) => {
    e.preventDefault();
    console.log(e);
    const geojsonInput = $("#geojson-input").val();
    const geojson = JSON.parse(geojsonInput);
    const wkt = wellknown.stringify(geojson);

    console.log('set wkt: ', wkt);
    $("#wkt-output").text(wkt);
  });

  $("#wkt-form").submit((e) => {
    console.log('submitted');
    e.preventDefault();
    console.log(e);
    const rawWKT = $("#wkt-input").val();
    console.log(rawWKT);
    const geojson = wellknown.parse(rawWKT);
    console.log(geojson);

    $("#geojson-output").text(JSON.stringify(geojson));
  });
});
