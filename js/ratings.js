function drawRatings() {
  let width = 960;
  let height = 500;
  let pad = 140;
  let diameter = 700;
  let radius = 83;

  d3.json("data_movie/combined/jsondatanew.json").then(drawHierarchy);
  d3.csv("data_movie/combined/movie_metadata_edited.csv").then(drawCircleChart);

  function drawHierarchy(data) {

    // THE LINK: https://observablehq.com/@d3/zoomable-sunburst

    arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1))

    const root = partition(data);

    root.each(d => d.current = d);

    const svg = d3.select("body").select("svg#raitings")
      .style("font", "10px sans-serif");

    const g = svg.append("g")
      .attr("id", "plot")
      .attr("transform", translate(pad + 120, pad + 110));

    const path = g.append("g")
      .selectAll("path")
      .data(root.descendants().slice(1))
      .join("path")
      .attr("fill", "grey")
      .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
      .attr("d", d => arc(d.current));

    path.filter(d => d.children)
      .style("cursor", "pointer")
      .on("click", clicked);

    path.append("title")
      .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    const label = g.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
      .selectAll("text")
      .data(root.descendants().slice(1))
      .join("text")
      .attr("dy", "0.35em")
      .attr("fill-opacity", d => +labelVisible(d.current))
      .attr("transform", d => labelTransform(d.current))
      .text(d => d.data.name);

    const parent = g.append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", clicked);

    function clicked(p) {
      parent.datum(p.parent || root);

      root.each(d => d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth)
      });

      const t = g.transition().duration(750);

      // Transition the data on all arcs, even the ones that aren’t visible,
      // so that if this transition is interrupted, entering arcs will start
      // the next transition from the desired position.
      path.transition(t)
        .tween("data", d => {
          const i = d3.interpolate(d.current, d.target);
          return t => d.current = i(t);
        })
        .filter(function(d) {
          return +this.getAttribute("fill-opacity") || arcVisible(d.target);
        })
        .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
        .attrTween("d", d => () => arc(d.current));

      label.filter(function(d) {
          return +this.getAttribute("fill-opacity") || labelVisible(d.target);
        }).transition(t)
        .attr("fill-opacity", d => +labelVisible(d.target))
        .attrTween("transform", d => () => labelTransform(d.current));

      //on another graph
      let newInput = [];
      let children = p.children;

      if (p.height - 1 == 1) {
        children.forEach(function(d) {
          newInput.push(d.data.children[0].name)
        })
      } else if (p.height - 1 == 0) {
        children.forEach(function(d) {
          newInput.push(d.data.name)
        })
      }

      let circles = d3.select("body").select("svg#raitings").selectAll(".circle")
      circles.style("fill", "lightgrey").attr("r", 3.5);

      showOnCircles(newInput);
    }

    function arcVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
      return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2 * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }
  }

  format = d3.format(",d")

  partition = data => {
    const root = d3.hierarchy(data)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);
    return d3.partition()
      .size([2 * Math.PI, root.height + 1])
      (root);
  }


  function translate(x, y) {
    return "translate(" + String(x) + "," + String(y) + ")";
  }

  function drawCircleChart(data) {

    let small_width = 400;
    let height = 500;

    const svg = d3.select("body").select("svg#raitings")
      .style("font", "10px sans-serif");

    let max_budget = 900000000;
    let max_imdb = 10;

    let y = d3.scaleLinear()
      .domain([0, max_imdb])
      .range([height - 60, 0]);

    let x2 = d3.scaleLinear()
      .domain([0, max_budget])
      .range([0, small_width - 50])

    let x = d3.scaleBand()
      .domain([0, 100000000, 200000000, 300000000, 400000000, 500000000, 600000000, 700000000, 800000000, 900000000])
      .range([0, small_width - 50])
      .padding([0.8])

    // add the X gridlines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", translate(small_width + 150, height - 40))
      .call(make_x_gridlines()
        .tickSize(-height + 60)
        .tickFormat("")
      )

    // add the Y gridlines
    svg.append("g")
      .attr("class", "grid")
      .attr("transform", translate(small_width + 150, 20))
      .call(make_y_gridlines()
        .tickSize(-small_width + 50)
        .tickFormat("")
      )

    // gridlines in x axis function
    function make_x_gridlines() {
      return d3.axisBottom(x)
        .ticks(5)
    }

    // gridlines in y axis function
    function make_y_gridlines() {
      return d3.axisLeft(y)
        .ticks(10)
    }

    let xAxis = d3.axisBottom(x);
    xAxis
      .tickFormat(d3.formatPrefix(".0", 1e6))
    let yAxis = d3.axisLeft(y);

    const plot_circle = svg.append("g")
    plot_circle.attr('id', 'plot');
    plot_circle.style("background", "grey");
    plot_circle.attr('transform', translate(small_width + 150, 20));
    plot_circle.attr("width", small_width).attr("height", height);

    let xGroup = plot_circle.append("g").attr("id", "x-axis");
    xGroup.call(xAxis).selectAll("text").attr('fill', 'black');
    xGroup.attr("transform", translate(0, height - 60));

    let yGroup = plot_circle.append("g").attr("id", "y-axis");
    yGroup.call(yAxis).selectAll("text").attr('fill', 'black');
    yGroup.attr("transform", translate(0, 0));

    let circles = plot_circle.selectAll(".circle")
      .data(data)
      .enter().append("circle")
      .attr("class", "circle")
      .attr("cx", d => x2(d.gross) + 30)
      .attr("cy", d => y(d.imdb_score))
      .attr("r", 3.5)
      .attr("fill", "lightgrey")
      .attr("stroke", "black")

    circles.on("mouseover.hover", function(d) {
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

    circles.on("mousemove.hover", function(d) {
      let div = d3.select("div#details");
      let bbox = div.node().getBoundingClientRect();

      div.style("left", d3.event.pageX + "px");
      div.style("top", (d3.event.pageY - bbox.height) + "px");
    });

    circles.on("mouseout.hover", function(d) {
      d3.select(this).classed("active-small", false);
      d3.select(this).style("stroke", "");
      d3.selectAll("div#details").remove();
    });


  }

  function showOnCircles(input){
    let circles = d3.select("body").select("svg#raitings").selectAll(".circle")

    input.forEach(function(input) {
      circles.filter(d => (d.movie_title.toLowerCase() === input.toLowerCase())).raise().transition().attr("r", 4.5).style("fill", "dodgerblue");
    })
  }

  //function to make tooltip look better
  function createTooltip(row, index) {

    let out = {};
    for (let col in row) {
      switch (col) {
        case 'movie_title':
          out['Title:\xa0'] = row[col];
          break;
        case 'genres':
          out['Main Genre:\xa0'] = row[col];
          break;
        case 'director_name':
          out['Director:\xa0'] = row[col];
          break;
        case 'imdb_score':
          out['Imbd Score:\xa0'] = row[col];
          break;
        case 'gross':
          out['Gross:\xa0'] = row[col];
          break;
        default:
          break;
      }
    }
    return out;
  }


}
