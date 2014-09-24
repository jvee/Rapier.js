var config = require('./server/config'),
	testHost = 'http://' + config.host + ':' + config.port + '/';

module.exports = {
	decl_1: {
		name: 'Instagram',
		baseURL: testHost,
		dataType: 'json',
		models: [{
					name: 'locations',
					endpoints: [{
									name: 'search',
									url: 'locations/search'
								},{
									name: 'get',
									url: 'locations/:id'
								},{
									name: 'recent',
									url: 'locations/:id/media/recent'
								}]
				}]
	},
	decl_1_normalized: {
		'.': {
			name: 'Instagram',
			baseURL: testHost,
			dataType: 'json',
			nodeType: 'root'
		},
		'.locations': {
			name: 'locations',
			nodeType: 'models'
		},
		'.locations.search': {
			name: 'search',
			url: 'locations/search',
			nodeType: 'endpoints'
		},
		'.locations.get': {
			name: 'get',
			url: 'locations/:id',
			nodeType: 'endpoints'
		},
		'.locations.recent': {
			name: 'recent',
			url: 'locations/:id/media/recent',
			nodeType: 'endpoints'
		}
	}
}