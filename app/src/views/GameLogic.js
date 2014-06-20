define(function(require, exports, module) {
    var View          = require('famous/core/View');
    var Surface       = require('famous/core/Surface');
    var Transform     = require('famous/core/Transform');
    var Modifier      = require('famous/core/Modifier');
    var Timer      = require('famous/utilities/Timer');
    var RotatingLogic = require('views/RotatingLogic');

    function GameLogic() {
        View.apply(this, arguments);

        var rootModifier = new Modifier();
        this.node = this.add(rootModifier);

        this.twoDDataStructure = {};
        this.is2d = false;
        this.board = this.board || _forceSlice(this.options.smallCube);
        this.currentSmallCubePos = _forceSlice(this.board);
        this.destroyerCubeLocation = this.options.destroyer;

        _createRotatingLogic.call(this);
        _createDevPerspectiveToggle.call(this);
        _destroyerMovement.call(this);
        _setListeners.call(this);
    }

    GameLogic.prototype = Object.create(View.prototype);
    GameLogic.prototype.constructor = GameLogic;
    

    GameLogic.DEFAULT_OPTIONS = {
        mainCubeSize: 400,
        destroyer: [ 3,  0,  3 ],
        smallCube: [
          [0, 0, 0 ],
          [1, 0, 0 ],
          [2, 0, 0 ],
          [3, 0, 0 ],
   
          [0, 1, 0 ],
          [1, 1, 0 ],
          [2, 1, 0 ],
          [3, 1, 0 ], 
         
          [0, 2, 0 ],
          [1, 2, 0 ],
          [2, 2, 0 ],
          [3, 2, 0 ],
         
          [0, 3, 0 ],
          [1, 3, 0 ],
          [2, 3, 0 ],
          [3, 3, 0 ]
        ]
    };

    function _createDevPerspectiveToggle () {
        var devSurface = new Surface({
          size: [50, 50],
          content: 'Toggle 2D/3D',
          properties: {
            textAlign: 'center',
            color: 'red',
            backgroundColor: 'black'
          }
        });

        var modifier = new Modifier ({
            origin: [0.1, 0.1]
        });

        devSurface.on('click', function () {
            if (this.is2d === false && _ableToConvertTo2d.call(this) === true) {
                this._eventOutput.trigger('is2d', true);
                this.is2d = !this.is2d;
            } else {
                this._eventOutput.trigger('is2d', false);
                this.is2d = !this.is2d;
                _convertTo3d.call(this);
            }
        }.bind(this));

        this.node.add(modifier).add(devSurface);
    }

    function _createRotatingLogic () {
        this.rotatingLogic = new RotatingLogic({
            mainCubeSize: this.options.mainCubeSize,
            destroyer: this.options.destroyer,
            smallCube: this.options.smallCube
        });
        this.node.add(this.rotatingLogic);
    }

    function _setListeners (){
        this.rotatingLogic.pipe(this._eventInput);
    }

    function _destroyerMovement(){
        this._eventInput.on('movingCube', function(data){
            console.log('original pos:', this.destroyerCubeLocation);
            console.log('nVec pos:', this.rotatingLogic.nVec);
            console.log('rVec pos:', this.rotatingLogic.rVec);

            var requestedPos = this.destroyerCubeLocation.slice();

            var didUpdate = false;
            for (var i =0; i<this.destroyerCubeLocation.length; i++){
                var tempUpdate = this.destroyerCubeLocation[i]
                    + this.rotatingLogic.rVec[i]*data[0] 
                    + this.rotatingLogic.nVec[i]*data[1];

                if (tempUpdate >= 0 && tempUpdate <= 3){
                    requestedPos[i] = tempUpdate;
                    didUpdate = true;
                }
            }

            var newPos = _DCcanMove.call(this, requestedPos);           

            if (newPos){
                this.destroyerCubeLocation = newPos;
                _removeSmallCube.call(this, newPos);
                this.rotatingLogic.setDestroyerPosition(newPos);
                console.log('New Pos:', newPos);
            }
        }.bind(this));
    }

    function _DCcanMove (newPos) {
      var currentAxis = _findCurrentXY(this.rotatingLogic.nVec, this.rotatingLogic.rVec, this.rotatingLogic.state);

      var newPos2D = [newPos[currentAxis.x], newPos[currentAxis.y]].join('');

      if (this.twoDDataStructure[newPos2D]) {
        return this.twoDDataStructure[newPos2D].pop();
      }

      return false;
    }

    function _removeSmallCube(pos){
        console.log('board', this);
        for(var i =0; i < this.currentSmallCubePos.length; i++){
            if (this.currentSmallCubePos[i][0] === pos[0] 
                && this.currentSmallCubePos[i][1] === pos[1] 
                && this.currentSmallCubePos[i][2] === pos[2]){
                this.currentSmallCubePos.slice(i,1);
                console.log('removed cube', pos);
                return;
            }
        }
        console.log('no cube removed', pos);
    }

    function _ableToConvertTo2d () {
      _create2dDataStructure.call(this);
      // find current zAxis and zPosNeg
      var currentAxis = _findCurrentXY.call(this, this.rotatingLogic.nVec, this.rotatingLogic.rVec, this.rotatingLogic.state);
      // find current destroyerCubeLocation
      var dcLocation = this.destroyerCubeLocation;
      var key =  '';
      key += dcLocation[currentAxis.x];
      key += dcLocation[currentAxis.y];

      // find current twoDDataStructure
      var currentSmallCubePos = this.twoDDataStructure;
      var match = currentSmallCubePos[key];

      return ( match &&
                (
                  ( currentAxis.zPosNeg > 0 && (dcLocation[currentAxis.z] < match[0][currentAxis.z])) ||
                  ( currentAxis.zPosNeg < 0 && (dcLocation[currentAxis.z] > match[0][currentAxis.z]))
                )
             ) ? false : true;
    }

    function _findCurrentXY (nVec, rVec, state) {
      // identifies which index is current X, Y, and Z

      var result = {}, i, j, k;

      for (i=0;i<nVec.length;i++) {
        if (nVec[i] !== 0) {
          result.y = i;
          result.yPosNeg = 1 * nVec[i];
          break;
        }
      }

      for (j=0;j<rVec.length;j++) {
        if (rVec[j] !== 0) {
          result.x = j;
          result.xPosNeg = 1 * rVec[j];
          break;
        }
      }

      for (k=0;k<state.length;k++) {
        if (state[k] !== 0) {
          result.z = k;
          result.zPosNeg = 1 * state[k];
          break;
        }
      }

      return result;
    }

    function _create2dDataStructure () {

      var currentAxis = _findCurrentXY(this.rotatingLogic.nVec, this.rotatingLogic.rVec, this.rotatingLogic.state);
      var key = '';
      var smallCube;
      
      this.currentSmallCubePos = _forceSlice(this.board);

      // creates twoDDataStructure
      // format: { XY coordinates: [[first visible box at XY], [second visible box at XY], [etc.]] }
      for (var j=0;j<this.currentSmallCubePos.length;j++) {
        smallCube = this.currentSmallCubePos[j];

        key = '';
        key += smallCube[currentAxis.x];
        key += smallCube[currentAxis.y];

        if (!this.twoDDataStructure[key]) {
          this.twoDDataStructure[key] = [smallCube];
        } else {
          this.twoDDataStructure[key].push(smallCube);
          if (currentAxis.zPosNeg > 0) {
            this.twoDDataStructure[key].sort(function (a, b) { return b[currentAxis.z] - a[currentAxis.z]; });
          } else {
            this.twoDDataStructure[key].sort(function (a, b) { return a[currentAxis.z] - b[currentAxis.z]; });
          }
        }

      }

      console.info('%c2D Data Structure: ', 'color: blue', this.twoDDataStructure);
    }

    function _convertTo3d () {
      this.twoDDataStructure = {};
    }

    function _forceSlice (array) {
      var newArray = [];
      for (var i=0;i<array.length;i++) {
        newArray.push(array[i].slice());
      }
      return newArray;
    }

    module.exports = GameLogic;
});