function drawRatings() {
  d3.csv("data_movie/combined/only-combined.csv").then(drawHierarchy);

function  drawHierarchy(data_csv) {
    let nested_data = d3.nest()
      .key(function(d) {
        return "San Francisco";
      })
      .key(function(d) {
        return d["Release Year"];
      })
      .key(function(d) {
        return d["Genre"];
      })
      .key(function(d) {
        return d["Title"]
      })
      .rollup(function(v) {
        return v.length;
      })
      .entries(data_csv);

    var blob = new Blob([JSON.stringify(nested_data)], {
      type: "text/plain;charset=utf-8"
    });

    console.log(JSON.stringify(nested_data));
  }
}
