var formBuilderInstances = [];

Fliplet.Widget.instance('interactive-floorplan', function(data) {
  var selector = '[data-interactive-floorplan-id="' + data.id + '"]';

  const $floorplan = new Vue({
    el: $(selector)[0],
    data() {
      return {
        isLoading: true,
        containsData: data.floors.length && data.markers.length,
        floors: data.floors.length ? data.floors : [],
        markerStyles: data.markers.length ? data.markers : [],
        markersDataSource: data.markersDataSourceId || undefined,
        markerNameColumn: data.markerNameColumn || undefined,
        markerFloorColumn: data.markerFloorColumn || undefined,
        markerTypeColumn: data.markerTypeColumn || undefined,
        markerXPositionColumn: data.markerXPositionColumn || undefined,
        markerYPositionColumn: data.markerYPositionColumn || undefined,
        markersData: undefined,
        mappedMarkerData: [],
        searchMarkerData: undefined,
        pinchzoomer: null,
        pzHandler: undefined,
        markerElemHandler: undefined,
        activeFloor: 0,
        activeMarker: 0,
        selectedFloorData: undefined,
        selectedMarkerData: undefined,
        selectedMarkerToggle: false,
        selectedPinchMarker: undefined,
        searchTimeout: null,
        searchValue: '',
        noSearchResults: false
      }
    },
    watch: {
      searchValue() {
        if (this.searchTimeout) {
          clearTimeout(this.searchTimeout)
          this.searchTimeout = null
        }
        this.searchTimeout = setTimeout(this.filterMarkers, 500)
      }
    },
    methods: {
      filterMarkers() {
        if (!this.searchValue) {
          this.noSearchResults = false
          this.searchMarkerData = _.cloneDeep(this.mappedMarkerData)
          return
        }

        this.noSearchResults = false
        this.searchMarkerData = _.filter(this.mappedMarkerData, (marker) => {
          return _.some(['name', 'floor'], (key) => {
            return marker.data[key] && marker.data[key].toString().toLowerCase().indexOf(this.searchValue.toLowerCase()) > -1
          })
        })

        if (!this.searchMarkerData.length) {
          this.noSearchResults = true
        }
      },
      mapMarkerData() {
        const newMarkerData = this.markersData.map((marker) => {
          const markerData = _.find(this.markerStyles, { name: marker.data[this.markerTypeColumn] })
          return {
            id: marker.id,
            data: {
              name: marker.data[this.markerNameColumn],
              floor: marker.data[this.markerFloorColumn],
              type: marker.data[this.markerTypeColumn],
              icon: markerData ? markerData.icon : '',
              color: markerData ? markerData.color : '#333333',
              size: markerData ? markerData.size : '24px',
              positionx: marker.data[this.markerXPositionColumn],
              positiony: marker.data[this.markerYPositionColumn]
            }
          }
        })

        return newMarkerData
      },
      setupPinchZoomer() {
        if (!this.mappedMarkerData.length) {
          return
        }

        this.selectedFloorData = this.floors[this.activeFloor]
        this.selectedMarkerData = this.mappedMarkerData[this.activeMarker].data
        this.selectedMarkerToggle = true

        if (this.pinchzoomer) {
          this.pinchzoomer = null
        }

        this.pinchzoomer = new PinchZoomer($('#floor-' + this.selectedFloorData.id), {
          adjustHolderSize: false,
          maxZoom: 4,
          initZoom: 1,
          zoomStep: 0.25,
          allowMouseWheelZoom: true,
          animDuration: 0.1,
          scaleMode: 'proportionalInside',
          allowCenterDrag: true
        })

        this.pzHandler = new Hammer(this.pinchzoomer.elem().get(0))

        this.addMarkers(true)
        this.selectPinchMarker()
      },
      selectPinchMarker() {
        // Remove any active marker
        $('.marker').removeClass('active')
        // Get markers
        const markers = this.pinchzoomer.markers()
        // Store first marker
        const marker = markers[0]

        // Find the new selected marker from pinchzoomer
        this.selectedPinchMarker = _.find(markers, (marker) => {
          return marker._vars.id === this.mappedMarkerData[this.activeMarker].id
        })
        // Apply class active
        if (this.selectedPinchMarker) {
          $(this.selectedPinchMarker.elem().get(0)).addClass('active')
        } else {
          this.activeMarker = _.findIndex(this.mappedMarkerData, (o) => { return o.id == marker._vars.id })
          this.selectedMarkerData = this.mappedMarkerData[this.activeMarker].data
          $(markers[0].elem().get(0)).addClass('active')
        }
      },
      addMarkers(fromLoad, options) {
        this.pinchzoomer.removeMarkers(true)

        this.mappedMarkerData.forEach((marker, index) => {
          if (marker.data.floor === this.selectedFloorData.name) {
            const markerElem = $("<div id='marker-" + index + "' class='marker' data-tooltip='" + marker.data.name + "' style='left: -15px; top: -15px; position: absolute; width: " + marker.data.size + "; height: " + marker.data.size + ";'><i class='" + marker.data.icon + "' style='color: " + marker.data.color + "; font-size: " + marker.data.size + ";'></i><div class='active-state' style='background-color: " + marker.data.color + ";'></div></div>")

            this.markerElemHandler = new Hammer(markerElem.get(0))
            this.pinchzoomer.addMarkers([new Marker(markerElem, { x: marker.data.positionx, y: marker.data.positiony, transformOrigin: '50% 50%', name: marker.data.name, id: marker.id })])
            this.markerElemHandler.on('tap', this.onMarkerHandler)
          }
        })
      },
      onMarkerHandler(e) {
        const markers = this.pinchzoomer.markers()
        const id = $(e.target).attr('id')
        const marker = _.find(markers, (o) => { return o.elem().attr('id') == id })
        this.activeMarker = _.findIndex(this.mappedMarkerData, (o) => { return o.id == marker._vars.id })
        this.selectPinchMarker()
        this.selectedMarkerData = this.mappedMarkerData[this.activeMarker].data
        this.selectedMarkerToggle = true
      },
      setActiveFloor(floorIndex, fromSearch) {
        if (this.activeFloor !== floorIndex) {
          this.activeFloor = floorIndex
        }

        if (!fromSearch) {
          this.setupPinchZoomer()
        }

        this.toggleFloorOverlay(false)
      },
      setActiveMarker(markerIndex) {
        if (this.activeMarker !== markerIndex) {
          this.activeMarker = markerIndex
          this.setupPinchZoomer()
        }

        this.toggleSearchOverlay(false)
      },
      selectedMarker(markerData) {
        const floorIndex = _.findIndex(this.floors, (o) => { return o.name == markerData.data.floor })
        const markerIndex = _.findIndex(this.mappedMarkerData, (o) => { return o.data.name == markerData.data.name })

        this.setActiveFloor(floorIndex, true)
        this.setActiveMarker(markerIndex)
      },
      removeSelectedMarker() {
        this.selectedMarkerToggle = false

        // Wait for animation
        setTimeout(() => {
          // Remove any active marker
          $('.marker').removeClass('active')
          this.selectedMarkerData = undefined
        }, 250)
      },
      closeFloorsOverlay() {
        this.toggleFloorOverlay(false)
      },
      toggleFloorOverlay(forceOpen) {
        if (typeof forceOpen === 'undefined') {
          $(selector).find('.floorplan-floors-overlay').toggleClass('overlay-open')
          return
        }
        
        $(selector).find('.floorplan-floors-overlay')[forceOpen ? 'addClass' : 'removeClass']('overlay-open')
      },
      closeSearchOverlay() {
        this.toggleSearchOverlay(false)
      },
      toggleSearchOverlay(forceOpen) {
        this.searchValue = ''

        if (typeof forceOpen === 'undefined') {
          $(selector).find('.floorplan-search-overlay').toggleClass('overlay-open')
          return
        }
        
        $(selector).find('.floorplan-search-overlay')[forceOpen ? 'addClass' : 'removeClass']('overlay-open')
      },
      connectToDataSource(id) {
        const cache = {
          offline: true
        }

        return Fliplet.DataSources.connect(id, cache)
          .then((connection) => {
            return connection.find()
          })
      }
    },
    async mounted() {
      this.markersData = await this.connectToDataSource(this.markersDataSource)
      this.mappedMarkerData = this.mapMarkerData()
      this.searchMarkerData = _.cloneDeep(this.mappedMarkerData)
      this.$nextTick(this.setupPinchZoomer)
    },
    beforeDestroy() {
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout)
        this.searchTimeout = null
      }
    }
  });
});
