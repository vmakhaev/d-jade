var assert = require("assert");
var fs = require("fs");
var app = {
  viewExtensions: [],
  compilers: {}
}
var dJade = require("../");

describe("test", function() {
  it("jade + js", function() {
    dJade(app);
    var compiler = app.compilers[".jade"];
    var jade = fs.readFileSync(__dirname + "/views/js.jade", "utf8");
    var html = fs.readFileSync(__dirname + "/views/result.html", "utf8");
    assert.equal(compiler(jade), html);
  });

  it("jade + coffee", function() {
    dJade(app, {coffee: true});
    var compiler = app.compilers[".jade"];
    var jade = fs.readFileSync(__dirname + "/views/coffee.jade", "utf8");
    var html = fs.readFileSync(__dirname + "/views/result.html", "utf8");
    assert.equal(compiler(jade), html);
  });
});