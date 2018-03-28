function toggleCurrent($current, $next) {
  if ($next.length > 0) {
    $current.toggleClass("current");
    $next.toggleClass("current");
  }
}
function forward() {
  toggleCurrent($(".outline-2.current").first(), $(".outline-2.current").next(".outline-2"));
}

function back() {
  toggleCurrent($(".outline-2.current").first(), $(".outline-2.current").prev(".outline-2"));
}

$(document).ready(() => {
  console.log($(".outline-2").first());
  $(".outline-2").first().addClass("current")

  $(document).keydown(function(e) {
    switch(e.which) {
    case 37: // left
      back();
      break;
    case 39: // right
      forward();
      break;
    default: return; // exit this handler for other keys
    }
    e.preventDefault(); // prevent the default action (scroll / move caret)
  });
});
