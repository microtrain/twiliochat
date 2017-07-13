function lurker(){
    this.content = '';
    this.watchFor = '';
    this.whatToExecute = '';
}

lurker.prototype.start = function(elementToWatch, watchFor){
    var self = this;
    this.content = $(elementToWatch).html();
    this.watchFor = watchFor;
    
    var domCheckInterval = setInterval(function(){
        
        if(self.watchFor==='exist'){
            if($(elementToWatch).html() !== undefined){
                clearInterval(domCheckInterval);
                self.whatToExecute();
            }
        }
        
        if(self.watchFor==='change'){            
            if(self.content == undefined){
                if($(elementToWatch).html() !== undefined){
                    self.content = $(elementToWatch).html();
                }                
            }else if(self.content != $(elementToWatch).html()){
                clearInterval(domCheckInterval);
                self.whatToExecute();
            }
        }
        
    },100);

    return self;
};

lurker.prototype.whenReady = function(functionToExecute){
    this.whatToExecute = functionToExecute;
}