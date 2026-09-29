import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={hasError:false};
  }

  static getDerivedStateFromError(){
    return {hasError:true};
  }

  componentDidCatch(error,info){
    console.error('Just Fuel app error',error,info);
    try{window.jfTrack?.('fatal_error_screen',{message:String(error?.message||'Unknown error').slice(0,180)},'error')}catch{}
  }

  reload=()=>{
    try{window.jfTrack?.('fatal_error_reload_clicked',{},'recovery')}catch{}
    window.location.reload();
  };

  render(){
    if(this.state.hasError){
      return <div className="jf-error-screen" role="alert" aria-labelledby="jf-error-title">
        <div className="jf-error-card">
          <div className="jf-error-mark" aria-hidden="true">JF</div>
          <h1 id="jf-error-title">Something went wrong</h1>
          <p>Reload the app to continue. Your saved account and basket are not cleared by this screen.</p>
          <button type="button" onClick={this.reload}>Reload app</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}
