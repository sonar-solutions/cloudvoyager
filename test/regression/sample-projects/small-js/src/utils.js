// Intentional code smells for SonarQube to flag as issues
function processData(data) {
  var result = []; // var instead of let/const
  for (var i = 0; i < data.length; i++) {
    if (data[i] != null) { // == instead of ===
      result.push(data[i]);
    }
  }
  return result;
}

function handleError(err) {
  console.log(err); // console.log in production code
  return null; // swallowing error
}

function duplicateLogic(items) {
  var output = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].active == true) { // == instead of ===
      output.push(items[i].name);
    }
  }
  return output;
}

function unusedFunction() {
  var x = 1;
  var y = 2;
  return x;
  return y; // dead code
}

function complexFunction(a, b, c, d, e) {
  if (a) {
    if (b) {
      if (c) {
        if (d) {
          if (e) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

function sqlBuilder(userInput) {
  var query = "SELECT * FROM users WHERE name = '" + userInput + "'"; // SQL injection
  return query;
}

function evalUsage(code) {
  return eval(code); // eval usage
}

module.exports = { processData, handleError, duplicateLogic, unusedFunction, complexFunction, sqlBuilder, evalUsage };
