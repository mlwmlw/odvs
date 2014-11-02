
function checkModal(text, cb) {
	$('#checkModal').modal('show');
	$('#checkModal h3').text(text);
	$('#checkModal .btn-primary').one('click', function() {
		cb(true);
		$('#checkModal').modal('hide');
	});
	$('#checkModal').on('hidden', function () {
		$('#checkModal .btn-primary').unbind('click');
	})
}
function refresh() {
	setTimeout(function() {
		window.location.href = window.location.href;
	}, 300);
}