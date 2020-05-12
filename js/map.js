function drawMap() {
  const urls = {
    basemap: "https://data.sfgov.org/resource/6ia5-2f8k.geojson", //SF Find Neighborhoods
    //  streets: "https://data.sfgov.org/resource/3psu-pn9h.geojson?$limit=15000",
    //  cases: "https://data.sfgov.org/resource/vw6y-z8j6.geojson"
  };

  // configuration of svg/plot area
  let config = {
    'svg': {},
    'margin': {},
    'plot': {}
  };

  let width = 960;
  let height = 500;

  // calculate date range
  const end = d3.timeDay.floor(d3.timeDay.offset(new Date(), -28));
  const start = d3.timeDay.floor(d3.timeDay.offset(end, -28));
  const format = d3.timeFormat("%Y-%m-%dT%H:%M:%S");

  const svg = d3.select("body").select("svg#vis")
    .attr("style", "outline: thin solid lightgrey;");
  // setup plot area
  let plot = svg.select("g#plot")
  plot.attr('id', 'plot');
  plot.style("background", "blue");
  plot.attr('transform', translate(80, 10));

  const g = {
    basemap: plot.select("g#basemap"),
    streets: plot.select("g#streets"),
    outline: plot.select("g#outline"),
    movies: plot.select("g#movies"),
    details: plot.select("g#details"),
    tooltip: plot.select("g#tooltip"),
    tooltipsmall: plot.select("g#tooltipsmall"),
    legend: plot.select("g#legend"),
  };

  const details = g.details.append("foreignObject")
    .attr("id", "details")
    .attr("width", 960)
    .attr("height", 500)
    .attr("x", 0)
    .attr("y", 0);

  const tooltip = g.tooltip.append("foreignObject")
    .attr("id", "tooltip")
    .attr("width", 960)
    .attr("height", 500)
    .attr("x", 0)
    .attr("y", 0);

  // setup tooltip (shows neighborhood name)
  const tip = g.tooltipsmall.append("text").attr("id", "tooltipsmall");
  tip.attr("text-anchor", "end");
  tip.attr("dx", -5);
  tip.attr("dy", -5);
  tip.style("visibility", "hidden");

  const body = details.append("xhtml:body")
    .style("text-align", "left")
    .style("background", "none")
    .html("<p>N/A</p>");

  details.style("visibility", "hidden");

  const projection = d3.geoConicEqualArea();
  projection.parallels([37.692514, 37.840699]);
  projection.rotate([122, 0]);
  const path = d3.geoPath().projection(projection);

  d3.json(urls.basemap).then(function(json) {
    projection.fitSize([900, 500], json);
    drawBasemap(json);

    d3.json("data_movie/blocks.geojson").then(drawStreets);
    d3.csv("data_movie/film-locations-in-san-francisco_no_dups.csv").then(function(d) {
      drawMovies(d);
      drawBarChart(d);
    });

    drawLegend();
  });

  function drawBasemap(json) {

    const basemap = g.basemap.selectAll("path.land")
      .data(json.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "land");

    const outline = g.outline.selectAll("path.neighborhood")
      .data(json.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "neighborhood")
      .each(function(d) {
        d.properties.outline = this;
        d.properties.centroid = path.centroid(d);
      });

    let zoomTrans = {
      x: 0,
      y: 0,
      scale: 1
    }

    //mouse up
    //use the scale to decide on symbols small/large
    const zoom = d3.zoom()
      .scaleExtent([1, 8])
      .on("zoom", () => {
        zoomTrans.scale = d3.event.transform.k;
        //console.log(zoomTrans.scale);
        let circles = g.movies.selectAll("circle");
        if (zoomTrans.scale < 2.3) {
          circles.attr("r", 4 / zoomTrans.scale);
        } else if (zoomTrans.scale > 5) {
          circles.attr("r", 1.5);
        } else {
          circles.attr("r", 2);
        }
        zoomed();
      });

    plot.call(zoom);

    // add highlight
    basemap.on("mouseover.highlight", function(d) {
        d3.select(d.properties.outline).raise();
        d3.select(d.properties.outline).classed("active_js", true);
      })
      .on("mouseout.highlight", function(d) {
        d3.select(d.properties.outline).classed("active_js", false);
      });

    // add tooltip
    basemap.on("mouseover.tooltip", function(d) {
        tip.text(d.properties.name);
        tip.style("visibility", "visible");
      })
      .on("mousemove.tooltip", function(d) {
        const coords = d3.mouse(g.basemap.node());
        tip.attr("x", coords[0]);
        tip.attr("y", coords[1]);
      })
      .on("mouseout.tooltip", function(d) {
        tip.style("visibility", "hidden");
      });

  }

  function zoomed() {
    d3.select("body").select("g#plot")
      .attr('transform', d3.event.transform);
  }

  function drawStreets(json) {
    //console.log("streets", json);

    const streets = json.features.filter(function(d) {
      return d;
    });

    g.streets.selectAll("path.street")
      .data(streets)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("class", "street");
  }

  function drawMovies(json) {

    let color = d3.scaleSequential(d3.interpolateViridis) //interpolatePlasma)
      .domain([1915, 2019]);

    // loop through and add projected (x, y) coordinates
    // (just makes our d3 code a bit more simple later)
    json.forEach(function(d) {
      const latitude = parseFloat(d.Latitude);
      const longitude = parseFloat(d.Longitude);
      const pixels = projection([longitude, latitude]);
      d.x = pixels[0];
      d.y = pixels[1];
      d.year = parseInt(d["Release Year"]);
    });

    const symbols = g.movies.selectAll("circle")
      .data(json)
      .enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 4)
      .attr("fill", d => color(d.year))
      .attr("class", "symbol");

    symbols.on("mouseover.hover", function(d) {
      d3.select(this).raise();
      d3.select(this).style("stroke", "black");
      d3.select(this).classed("active-small", true);

      let div = d3.select("body").append("div");

      div
        .attr("id", "details")
        .attr("class", "tooltip");

      let dataNew = createTooltip(Object(d));

      let rows = div
        .append("tablenew")
        .selectAll("tr")
        .data(Object.keys(dataNew))
        .enter()
        .append("tr");

      rows.append("th").text(key => key);
      rows.append("td").text(key => dataNew[key]);
      div.style("display", "inline");
    });

    symbols.on("mousemove.hover", function(d) {
      let div = d3.select("div#details");
      let bbox = div.node().getBoundingClientRect();

      div.style("left", d3.event.pageX + "px");
      div.style("top", (d3.event.pageY - bbox.height) + "px");
    });

    symbols.on("mouseout.hover", function(d) {
      d3.select(this).classed("active-small", false);
      d3.select(this).style("stroke", "");
      d3.selectAll("div#details").remove();
    });
  }

  function translate(x, y) {
    return "translate(" + String(x) + "," + String(y) + ")";
  }

  //function to make tooltip look better
  function createTooltip(row, index) {

    let out = {};
    for (let col in row) {
      switch (col) {
        case 'Title':
          out['Title:\xa0'] = row[col];
          break;
        case 'Release Year':
          out['Release Year:\xa0'] = row[col];
          break;
        case 'Locations':
          out['Address:\xa0'] = row[col];
          break;
        case 'Director':
          out['Director:\xa0'] = row[col];
          break;

        default:
          break;
      }
    }
    return out;
  }

  function updateMap(startYear, endYear) {

    const symbols = g.movies.selectAll("circle")

    symbols.filter(d => (d.year > endYear || d.year < startYear)).transition().style("display", "none");
    symbols.filter(d => (d.year <= endYear && d.year >= startYear)).raise().transition().style("display", "inline");

    let new_text;
    if (startYear !== endYear) {
      new_text = `Year Range: ${startYear} - ${endYear}`;
    } else {
      new_text = `Year: ${startYear}`;
    }

    d3.select("body").select("svg#barchart").selectAll('text.years-text')
      .text(
        new_text
      );

  }

  function drawLegend() {
    //create legend
    svg.append("g").attr("id", "legend");
    let legend = d3.select("svg#vis").select("g#legend");
    let legendColor = d3.scaleSequential(d3.interpolateViridis)
      .domain([1915, 2019]);

    const defs = svg.append("defs");

    const linearGradient = defs.append("linearGradient")
      .attr("id", "linear-gradient");

    linearGradient.selectAll("stop")
      .data(legendColor.ticks().map((t, i, n) => ({
        offset: `${100*i/n.length}%`,
        color: legendColor(t)
      })))
      .enter().append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

    svg
      .append('g')
      .attr("transform", translate(450, 20))
      .append("rect")
      .attr('transform', translate(380, 0))
      .attr("width", 100)
      .attr("height", 10)
      .style("fill", "url(#linear-gradient)");

    legend
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 820)
      .attr("y", 40)
      .text("1915")
      .attr("alignment-baseline", "middle")
      .style('fill', 'black');

    legend
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 920)
      .attr("y", 40)
      .text("2019")
      .attr("alignment-baseline", "middle")
      .style('fill', 'black');

    legend
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 848)
      .attr("y", 10)
      .text("Release Year")
      .attr("alignment-baseline", "middle")
      .style('fill', 'black');
  }

  //http://codexe.net/d3/d3-brush-zoom-bar-chart.html

  function drawBarChart(data) {
    // configuration of svg/plot area
    let config = {
      'svg': {},
      'margin': {},
      'plot': {}
    };

    let width = 960;
    let height = 500;

    const svg = d3.select("body").select("svg#barchart")
      .attr("style", "outline: thin solid lightgrey;");

    svg
      .append("text")
      .attr("class", "years-text")
      .attr("x", 430)
      .attr("y", 13)
      .text("Year Range: 1915 - 2019")
      .attr("alignment-baseline", "middle")
      .style('fill', 'black');

    svg
      .append("text")
      .attr("class", "text")
      .attr("x", width - 35)
      .attr("y", height - 30)
      .text("Year")
      .attr("alignment-baseline", "middle")
      .style('fill', 'black');

    svg
      .append("text")
      .attr("class", "text")
      .attr("x", 10)
      .attr("y", 100)
      .text("# of Movies Locations")
      .attr("alignment-baseline", "middle")
      .style('fill', 'black');

    const plot = svg.append("g")
    plot.attr('id', 'plot');
    plot.style("background", "grey");
    plot.attr('transform', translate(40, 20));

    //console.log(data);

    data.forEach(function(d) {
      d.year = d["Release Year"];
    })

    let merged = Object.values(data.reduce((r, o) => {
      r[o.year] = r[o.year] || {
        year: o.year,
        count: 0
      };
      r[o.year].count += 1;
      return r;
    }, {}));

    //console.log("merged", merged);
    let max = 0;
    merged.forEach(function(d) {
      if (d.count > max) {
        max = d.count;
      }
    });

    let y = d3.scaleLinear()
      .domain([0, max])
      .range([height - 160, 0]);

    let years = merged.map(d => d.year);
    years.sort()
    let x = d3.scaleBand()
      .domain(years) // all region (not using the count here)
      .rangeRound([0, width - 60])
      .paddingInner(0.30) // space between bars

    let xAxis = d3.axisBottom(x);
    let yAxis = d3.axisLeft(y);

    let xGroup = plot.append("g").attr("id", "x-axis");
    xGroup.call(xAxis).selectAll("text").attr('transform', 'translate(10,0)rotate(80 -10 10)')
    xGroup.attr("transform", translate(0, height - 70));

    let yGroup = plot.append("g").attr("id", "y-axis");
    yGroup.call(yAxis);
    yGroup.attr("transform", translate(0, 90));

    let bars1 = svg.selectAll(".bar")
      .data(merged)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) {
        return x(d.year) + 35;
      })
      .attr("width", x.bandwidth())
      .attr("y", function(d) {
        return y(d.count) + 100;
      })
      .attr("height", function(d) {
        return height - 150 - y(d.count);
      });

    //create small bar chart for interaction
    let height2 = 50;
    let y2 = d3.scaleLinear()
      .domain([0, max])
      .range([height2, 0]);

    let x2 = d3.scaleBand()
      .domain(years)
      .rangeRound([0, width - 60])
      .paddingInner(0.30)

    let xAxis2 = d3.axisBottom(x2);
    let yAxis2 = d3.axisLeft(y2);

    let xGroup2 = plot.append("g").attr("id", "x-axis");
    xGroup2.call(xAxis2).selectAll("text").attr('transform', 'translate(10,0)rotate(80 -10 10)').style("opacity", "0");
    xGroup2.attr("transform", translate(0, height2));

    let yGroup2 = plot.append("g").attr("id", "y-axis2");
    yGroup2.call(yAxis2).selectAll("text").style("opacity", "0");
    yGroup2.attr("transform", translate(0, 0));

    let bars2 = svg.selectAll(".bar#small")
      .data(merged)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) {
        return x2(d.year) + 45;
      })
      .attr("width", x2.bandwidth())
      .attr("y", function(d) {
        return y2(d.count) + 15;
      })
      .attr("height", function(d) {
        return height2 + 5 - y2(d.count);
      });

    let brush = d3.brushX()
      .extent([
        [0, 0],
        [width, height2]
      ])
      .on("brush", brushed)
      .on("end", brush_end);

    svg.append("g")
      .attr("class", "brush")
      .attr("transform", translate(45, 20))
      .call(brush)
      .call(brush.move, x2.range());

    function brushed() {
      if (!d3.event.sourceEvent) return;
      if (!d3.event.selection) return;
      if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return;
      var newInput = [];
      var brushArea = d3.event.selection;
      if (brushArea === null) brushArea = x.range();

      x2.domain().forEach(function(d) {
        var pos = x2(d) + x2.bandwidth() / 2;
        if (pos >= brushArea[0] && pos <= brushArea[1]) {
          newInput.push(d);
        }
      });

      x.domain(newInput);
      let startYear = 2020;
      let endYear = 0;
      newInput.forEach(function(d) {
        if (d > endYear) {
          endYear = d;
        }
        if (d < startYear) {
          startYear = d;
        }
      })

      updateMap(startYear, endYear);

      bars1
        .attr("x", function(d) {
          if (x(d.year) == null) {
            return 0;
          }
          return x(d.year) + 25;
        })
        .attr("width", x.bandwidth())
        .attr("y", function(d) {
          return y(d.count) + 100;
        })
        .attr("height", function(d, i) {
          if (x(d.year) == null) {
            return 0;
          }
          return height - 150 - y(d.count);
        })
        .attr("transform", translate(15, 0));

      xGroup.call(xAxis).selectAll("text").attr("transform", 'translate(10,0)rotate(80 -10 10)');
    }

    function brush_end() {

      if (!d3.event.sourceEvent) return;
      if (!d3.event.selection) return;
      if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return;
      var newInput = [];
      var brushArea = d3.event.selection;
      if (brushArea === null) brushArea = x.range();


      x2.domain().forEach(function(d) {
        var pos = x2(d) + x2.bandwidth() / 2;
        if (pos >= brushArea[0] && pos <= brushArea[1]) {
          newInput.push(d);
        }
      });
      //relocate the position of brush area
      var increment = 0;
      var left = x2(d3.min(newInput));
      var right = x2(d3.max(newInput)) + x2.bandwidth();

      d3.select(this).transition().call(d3.event.target.move, [left, right]);
    }

    bars1.on("mouseover.hover", function(d) {
      d3.select(this).raise();
      d3.select(this).style("stroke", "darkgrey");
      d3.select(this).classed("active-small", true);

      let div = d3.select("body").append("div");

      div
        .attr("id", "details")
        .attr("class", "tooltip");

      let dataNew = createTooltipBarChart(Object(d));

      let rows = div
        .append("tablenew")
        .selectAll("tr")
        .data(Object.keys(dataNew))
        .enter()
        .append("tr");

      rows.append("th").text(key => key);
      rows.append("td").text(key => dataNew[key]);
      div.style("display", "inline");
    });

    bars1.on("mousemove.hover", function(d) {
      let div = d3.select("div#details");
      let bbox = div.node().getBoundingClientRect();

      div.style("left", d3.event.pageX + "px");
      div.style("top", (d3.event.pageY - bbox.height) + "px");
    });

    bars1.on("mouseout.hover", function(d) {
      d3.select(this).classed("active-small", false);
      d3.select(this).style("stroke", "");
      d3.selectAll("div#details").remove();
    });

    //function to make tooltip look better
    function createTooltipBarChart(row, index) {
      let out = {};
      for (let col in row) {
        switch (col) {
          case 'year':
            out['Release Year:\xa0'] = row[col];
            break;
          case 'count':
            out['# of Movies:\xa0'] = row[col];
            break;
          default:
            break;
        }
      }
      return out;
    }

  }
}
